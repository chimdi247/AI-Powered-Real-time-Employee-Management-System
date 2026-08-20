# Role-based sidebar shell on the protected layout

## Goal

Give the protected routes a **shadcn sidebar app shell**:

1. A collapsible sidebar (desktop icon-rail, mobile off-canvas Sheet) wrapping every protected page.
2. **Role-based navigation**: links visible depend on the signed-in user's role.
   - Everyone: Dashboard.
   - **Employee**: My Profile, My Leave Requests.
   - **Admin**: Manage Users, Departments, Reports, Manage Leaves.
3. A **logout button** in the sidebar footer (with the user's avatar/name/role) that clears the session and redirects to the login page.

The sidebar nav pages don't exist yet (they're later roadmap steps), so each link gets a **thin placeholder route** — the same pattern already established with the dashboard placeholder — so navigation never 404s.

## Context

- Auth is cookie-based; TanStack Query owns the session (`useCurrentUser`, `useLogin`, `useLogout`). `useLogout` already resets the `me` query on success, so the UI flips to signed-out immediately.
- Current routing (`app/routes.ts`): `index(home)` + `layout("routes/protected.tsx", [ route("dashboard") ])`. `@react-router/dev/routes` exports `index, route, layout, prefix` (verified in the installed package).
- The full shadcn v4 sidebar component exists in `app/components/ui/sidebar.tsx` (SidebarProvider/Sidebar/SidebarInset/SidebarHeader/SidebarContent/SidebarFooter/SidebarGroup/SidebarMenu/SidebarMenuButton/SidebarTrigger/SidebarSeparator/...). It is Base-UI-based: nav items render as links via the `render` prop, e.g. `<SidebarMenuButton render={<Link to="/dashboard" />} isActive={...}>` (verified: `useRender` accepts a `ReactElement`).
- Design system: theme tokens only (sidebar tokens already defined in `app.css`), lucide-react icons, intentional states, accessible, responsive (sidebar handles mobile via `useIsMobile`).
- `verbatimModuleSyntax` → `import type`.
- Package manager: Bun.

## Implementation

1. **`app/routes.ts`** — register the new placeholder routes under the protected layout, grouped with `prefix`:
   ```ts
   layout("routes/protected.tsx", [
     route("dashboard", "routes/dashboard.tsx"),
     route("profile", "routes/profile.tsx"),
     route("leaves", "routes/leaves.tsx"),
     prefix("admin", [
       route("users", "routes/admin/users.tsx"),
       route("departments", "routes/admin/departments.tsx"),
       route("reports", "routes/admin/reports.tsx"),
       route("leaves", "routes/admin/leaves.tsx"),
     ]),
   ])
   ```
2. **New `app/components/layout/app-shell.tsx`** — the app chrome, rendered by the protected layout:
   - `<SidebarProvider>` wrapping `<AppSidebar />` + `<SidebarInset>`.
   - Inside the inset: a slim header (`h-14`, border-b) with `<SidebarTrigger />` + vertical `Separator` (standard shadcn pattern; the trigger opens the mobile Sheet).
   - `<Outlet />` below the header — pages render their own content.
3. **New `app/components/layout/app-sidebar.tsx`**:
   - Nav config as data: items `{ title, to, icon }` grouped, each group tagged with `roles?: Role[]` (undefined = everyone). Filter by `useCurrentUser().data.role`.
     - General: Dashboard.
     - "My workspace" (employee): My Profile (`/profile`), My Leave Requests (`/leaves`).
     - "Administration" (admin): Manage Users (`/admin/users`), Departments (`/admin/departments`), Reports (`/admin/reports`), Manage Leaves (`/admin/leaves`).
   - `SidebarHeader`: brand mark (reuse the `Building2` mark styling from the login page) + "EMS" wordmark.
   - `SidebarContent` → `SidebarGroup` per nav group (group label + menu items). Menu items are `SidebarMenuButton` with `render={<Link to={item.to} />}` and `isActive={pathname === item.to}` (via `useLocation`).
   - `SidebarFooter`: user card — `Avatar` (initials from name), name + role, and a logout `Button` (`useLogout`; `onSuccess` → `navigate("/")`, spinner while pending).
4. **New `app/components/layout/page-placeholder.tsx`** — shared intentional empty state for the placeholder routes: centered card with icon, title, description ("This section is coming soon."), consistent with the design system.
5. **New placeholder routes** (thin, per knowledge.md): `routes/profile.tsx`, `routes/leaves.tsx`, `routes/admin/users.tsx`, `routes/admin/departments.tsx`, `routes/admin/reports.tsx`, `routes/admin/leaves.tsx` — each: `meta()` title + `<PagePlaceholder icon={...} title="..." description="..." />`.
6. **`app/routes/protected.tsx`** — render the shell: `<RequireAuth><AppShell /></RequireAuth>` (guard stays; `AppShell` contains the `<Outlet />`).
7. **`app/routes/dashboard.tsx`** — slim down to content-only: drop its own `main max-w pt-16` wrapper and the now-redundant "Back to home" link (the sidebar provides navigation); keep the welcome header + signed-in card.

## Edge cases / notes

- **No auth flash**: `RequireAuth` still gates the layout, so `AppShell` only renders once a user is confirmed; the sidebar can read `useCurrentUser` data directly.
- **Logout**: `useLogout`'s resetQueries already evicts the session; navigate to `/` explicitly on success. The `RequireAuth` guard on any later protected visit redirects again.
- **Active state**: exact `pathname === to` match (no sub-path matching needed yet).
- **Mobile**: the `Sidebar` renders as a Sheet automatically (`useIsMobile`); nav works identically.
- **Offline**: guard already treats it as not-authenticated → login page; sidebar never renders without a user.
- No backend changes; token storage unchanged.

## Affected files

- New: `frontend/app/components/layout/app-shell.tsx`, `app-sidebar.tsx`, `page-placeholder.tsx`; `frontend/app/routes/profile.tsx`, `leaves.tsx`, `frontend/app/routes/admin/{users,departments,reports,leaves}.tsx`
- Modified: `frontend/app/routes.ts`, `frontend/app/routes/protected.tsx`, `frontend/app/routes/dashboard.tsx`

## Done when

- `bun run typecheck` + `bun run build` pass in `frontend/`.
- Signed in as admin: sidebar shows Dashboard + Administration group (users, departments, reports, leaves) + logout.
- Signed in as employee: sidebar shows Dashboard + My workspace group (profile, leaves) + logout — no admin links.
- Clicking a nav link navigates without 404 (placeholder page); logout clears the session and lands on the login page.
- Desktop sidebar collapses to icon rail; mobile shows the Sheet via the header trigger.

## Post-approval implementation & verification (2026-08-16)

- User approved with license to customize the design to be unique.
- New `app/components/layout/`: `app-shell.tsx` (SidebarProvider + h-14 header with SidebarTrigger/Separator + `<Outlet />`), `app-sidebar.tsx` (role-gated nav config, brand header, active-item left accent bar, user card + sign-out in footer), `page-placeholder.tsx` (shared empty state), `brand.tsx` (extracted shared BrandMark/BrandHeader; login page now imports them).
- `app/routes.ts`: added profile, leaves, and `prefix("admin")` group (users, departments, reports, leaves) under the protected layout — note `prefix()` returns an array, so it must be spread (`...prefix(...)`).
- New placeholder routes: `routes/profile.tsx`, `routes/leaves.tsx`, `routes/admin/{users,departments,reports,leaves}.tsx`.
- `routes/dashboard.tsx` slimmed to content-only (welcome header + placeholder; removed its own `main` wrapper and the back link).
- Sidebar footer: avatar (initials), name + role, ghost "Sign out" button — `useLogout` onSuccess navigates to `/`; RequireAuth bounces any later protected visit.
- Verified: `bun run typecheck` + `bun run build` pass (all placeholder chunks + protected shell emitted).
