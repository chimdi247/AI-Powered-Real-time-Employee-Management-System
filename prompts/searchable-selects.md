# Searchable selects (combobox) for backend-data dropdowns

## Goal

Make every `<Select>` that displays data fetched from the backend searchable, so users can
type to filter options — especially important once datasets grow large (many departments,
many users, etc.).

**Scope (user-confirmed: "All Select loading data from the backend")**: the only dropdown in
the app that loads its options from the backend is the **Department select** in the New/Edit
user dialog (`frontend/app/routes/admin/users.tsx`). The Role select is static (2 fixed
options) and stays a plain Select. The "Manage members" dialog in `admin/departments.tsx` is a
checkbox list, not a Select — out of scope for this change.

## Approach

Use the project's existing (currently unused) Base UI **Combobox** component at
`frontend/app/components/ui/combobox.tsx` — it is part of the design system, ships built-in
filtering via the `items` prop, and is the shadcn/base-ui intended replacement for a
searchable select. No new dependencies.

## Context

- Frontend: React Router + TanStack Query + Axios. The department options come from
  `useDepartments()` (`GET /departments`) already fetched in `UserFormDialog`.
- `@/components/ui/combobox.tsx` exports `Combobox`, `ComboboxInput`, `ComboboxContent`,
  `ComboboxEmpty`, `ComboboxList`, `ComboboxItem` (plus chips/group parts not needed here).
  `ComboboxInput` accepts `showClear` (clear button) and `id` (lands on the `<input>`, so
  `<Label htmlFor>` keeps working).
- Base UI Combobox behavior verified in `node_modules/@base-ui/react`:
  - With an `items` prop, filtering is automatic (locale-aware substring match on the label).
  - Single-select: input shows the selected item's label when closed; clearing the input or
    clicking the clear button sets the value to `null` (→ "No department").
  - Items as `{ value, label }` objects resolve labels automatically for display and
    serialization (no `itemToStringLabel`/`itemToStringValue` needed).
- `verbatimModuleSyntax` → `import type`. Package manager: Bun.
- Existing state: `department` is a `string` state seeded with the `NO_DEPARTMENT` sentinel
  (`"__none__"`); submit converts it to `string | null`. Keep this state machine — only the
  control changes.

## Frontend

1. **`app/routes/admin/users.tsx`** (`UserFormDialog`):
   - Import `Combobox`, `ComboboxContent`, `ComboboxEmpty`, `ComboboxInput`, `ComboboxItem`,
     `ComboboxList` from `@/components/ui/combobox`.
   - Build the options list with a `useMemo`: `(departments ?? []).map((d) => ({ value: d._id, label: d.name }))`.
   - Replace the Department `Select` with:
     ```tsx
     <Combobox
       items={departmentOptions}
       value={department === NO_DEPARTMENT ? null : department}
       onValueChange={(value) => setDepartment(value ?? NO_DEPARTMENT)}
       autoHighlight
     >
       <ComboboxInput
         id="user-department"
         placeholder="Search departments…"
         className="w-full"
         showClear
       />
       <ComboboxContent sideOffset={4}>
         <ComboboxEmpty>No departments found.</ComboboxEmpty>
         <ComboboxList>
           {(item) => (
             <ComboboxItem key={item.value} value={item.value}>
               {item.label}
             </ComboboxItem>
           )}
         </ComboboxList>
       </ComboboxContent>
     </Combobox>
     ```
   - Remove the now-unused `Select`-family imports **only if** the Role select no longer needs
     them (it still does — role stays a plain `Select`).
   - Keep the `NO_DEPARTMENT` sentinel, the `useEffect` reset, and the submit
     `departmentValue` logic unchanged.

## Design / UX

- Follow the existing ui-kit conventions: `Label` + `htmlFor`, full-width control in the
  `sm:grid-cols-2` cell, `ComboboxEmpty` for the no-results state, semantic tokens only.
- `showClear` gives the X button (visible when a department is selected) — clicking it
  unassigns the user (back to "No department").
- `autoHighlight` highlights the first match as the user types so Enter selects it (standard
  combobox-as-select behavior). No custom motion/styling — the component's defaults match the
  Select's look (rounded border, chevron, h-8).

## Edge cases

- No departments exist yet → empty options list; input still usable, `ComboboxEmpty` shows
  when nothing matches; the field remains optional (null = no department).
- Clearing the typed query in single-select mode clears the selection (Base UI behavior) —
  acceptable and consistent with "no department".
- Form submit: Enter with an open popup and highlighted item selects it (no submit); Enter
  with no highlight submits — same as the previous Select.
- Keep `aria-invalid`/validation behavior as-is (the combobox input accepts the same props).

## Affected files

- Modified: `frontend/app/routes/admin/users.tsx` (Department control → Combobox; role Select
  untouched).

## Done when

- `bun run typecheck` passes in `frontend/` (and `bun run build`).
- The Department field in New/Edit user dialogs is a searchable combobox: type-to-filter over
  department names, readable label when a department is selected, clear (X) returns to "No
  department", empty-results message, and the submitted value is still the department `_id`
  (or null).
- No other backend-data selects exist in the app that were missed.

## Post-approval implementation & verification (2026-08-17)

- **Frontend**: `routes/admin/users.tsx` — the Department field in the New/Edit user dialog is now a searchable Combobox (`@/components/ui/combobox.tsx`, Base UI) driven by a `departmentOptions` `useMemo` (`{ value: _id, label: name }[]`) from `useDepartments()`. Type-to-filter is automatic via the `items` prop; `autoHighlight` lets Enter pick the first match; `showClear` shows an X when a department is selected (clicking it → value `null` → "No department"); `ComboboxEmpty` shows "No departments found." on no match. The submitted value is still the department `_id` (or null) — the `NO_DEPARTMENT` sentinel and submit logic are unchanged. Role select untouched (static options).
- **Fix (2026-08-17, id-vs-name regression)**: the combobox input rendered the raw id because `stringifyAsLabel(selectedValue, …)` does not look up the `items` list for string values. Switched the selected value from the id string to the item object (`{ value, label }` from `departmentOptions`): `value={selectedDepartment}` (found by id, `null` for NO_DEPARTMENT), `onValueChange={(item) => setDepartment(item?.value ?? NO_DEPARTMENT)}`, and `ComboboxItem value={item}`. Objects with a `label` resolve automatically for both display and filtering; reference identity is preserved (same array elements), so default `Object.is` selection highlighting still works.
- Checks: `bun run typecheck` (tsc --noEmit) and `bun run build` both pass in `frontend/`.
- **Not runtime-tested** (no live backend/DB session): the combobox flow was verified by typecheck/build only — a browser pass against the running API is recommended (open the New/Edit user dialog, confirm the selected department shows its name, type to filter, clear via X, submit).
