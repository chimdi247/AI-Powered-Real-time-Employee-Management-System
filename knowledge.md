# Project knowledge

You are a **principal-level full-stack engineer and AI implementation agent** working on a production-grade Employee management system.

This file gives Freebuff context about the project: goals, commands, conventions, and gotchas.

> **NB: WORKFLOW STEPS MUST BE FOLLOWED** (see [Workflow](#workflow) below)
> **NB: FOR EVERY BACKEND LOCAL IMPORT, MUST END WITH ".js" - PROJECT WILL BE DEPLOYED ON VERCEL** -- **ONLY BACKEND REQUIRES ".js"**

---

## What this is

- **Package manager**: Bun (both frontend & backend use `bun.lock`)

## Quickstart

```bash
bun install
bun run dev            # starts dev server at http://localhost:5173
bun run build           # production build via react-router build
bun run typecheck       # typegen + TypeScript check
```

## Skills

Skills live in `.agents/skills/`. Load only what's relevant to the task.

**React Router**

- `.agents/skills/react-router/SKILL.md` — React Router v8 framework-mode

**Shadcn UI**

- `.agents/skills/shadcn/SKILL.md` — Shadcn UI components, Tailwind CSS, and design system conventions

**Resend**

- `.agents/skills/resend-email`
- `.agents/skills/resend`
- `.agents/skills/agent-email-inbox`
- `.agents/skills/email-best-practices`

## Prompt files

Prompt files live in `ems/prompts/`, named for the feature: `ems/prompts/auth.md`, `ems/prompts/crud.md`, etc.

Each prompt file should cover: goal, affected routes/endpoints, data model changes, edge cases, and what "done" looks like.

## Tech stack

- MERN stack (MongoDB, Express, React, Node.js) - React Router Framework
- JWT-based authentication and authorization
- Mongoose
- Tanstack Query for data fetching and caching + Axios for HTTP requests
- Tailwind CSS for styling
- Shadcn UI components for building the UI
- Nodemailer for email functionality

## Design system — "elegant, slick, modern," not default shadcn

- **Theme tokens**: all color comes from CSS variables (shadcn theme convention) in one place — never hardcoded hex in components. If no theme exists yet for a screen/feature, ask for the primary color (and accent, if relevant) before building it.
- **Typography**: pick a restrained type scale (e.g. one display/heading face + one body face, or a single well-weighted family like Inter/Geist) and stick to it. No more than ~5 font-size steps across the whole app.
- **Spacing**: use a consistent scale (Tailwind's 4px-based scale is fine) — don't eyeball padding/margins per component.
- **Motion**: subtle, purposeful transitions only (150–250ms, ease-out) — hover/press states, panel open/close, toast in/out. No decorative animation.
- **States are designed, not afterthoughts**: every table/list needs an intentional empty state, loading state (spinner), and error state — not a bare "No data."
- **Icons**: react-icons.
- **Responsive**: fully responsive on mobile. Desktop-first assumption is fine, but must not break on tablet.
- **Accessibility**: semantic HTML, visible focus states, sufficient contrast against the active theme — non-negotiable, not "nice to have."

## Features

- CRUD for users, employees records, leaves, and departments, with role-based access control (RBAC) for employees and admins.
- Authentication via JWT tokens, with secure password hashing and salting.
- Authorization middleware to protect routes based on user roles.
- Activity logging for auditing purposes, capturing user actions and changes to records.
- Announcements
- Email notifications via Nodemailer
- Stripe integration for payment processing (if applicable).
- Apply for leave, view leave status, and manage leave requests (for admins).
- Employee profile management, including personal information, contact details, and job-related information.
- Department management, allowing admins to create, update, and delete departments, as well as assign employees to departments.

## 📁 Project Structure - Architecture

```
ems/
├── backend/                     # Express REST API
│   └── src/
│       ├── server.ts            # Express entry point + route mounting
|       ├── db/                  # db connection
|       ├── models/              # Mongoose models
│       ├── controllers/         # Per-resource business logic
│       ├── routes/              # Per-resource routers (auth + role/permission gated)
│       ├── middlewares/         # requireAuth, requireRole, requirePermission
│       ├── lib/                 # prisma, auth, permissions, stripe, edgestore, activity-log
│       └── inngest/             # AI background functions
└── frontend/                    # React Router app (thin client to /backend)
    └── app/
        ├── routes/              # login, dashboard/* (framework-mode loaders/actions)
        ├── components/          # ui/ (shadcn), globals/ (reusable), feature components
        ├── lib/                 # api client
        ├── hooks/               # custom hooks e.g TanStack Query hooks
        └── types.ts             # Shared types mirroring backend DTOs
```

**Rules:**

- Every design should be custom, distinct from other designs out there — but consistency throughout the system is paramount.
- Keep the pages themselves minimal (`/routes`). Push logic and markup into components — dialogs, tables, stats cards, multi-select, etc.
- Create reusable components to keep the codebase clean and avoid redundancy.

## Roles

- employee: can create and update their own records, but cannot delete or update others' records.
- admin: can create, update, and delete any record in the system.

## Workflow

> **NB: WORKFLOW STEPS MUST BE FOLLOWED**

For every implementation request:

1. If there's meaningful ambiguity (data shape, permissions, package choice, UI pattern not yet established), ask one focused question.
2. Write a implementation prompt to `prompts/<name>.md`.
3. Ask: `I prepared the implementation prompt at prompts/<file-name>.md. Is this good to execute?`
4. Implement only after approval.
5. Run available checks (typecheck, lint, tests).
6. Share the edited files and in which pages for review.
