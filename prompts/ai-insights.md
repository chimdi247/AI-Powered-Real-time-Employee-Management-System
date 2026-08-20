# AI Insights Page

## Goal

Build an AI-powered insights page that generates actionable recommendations based on employee data (attendance, leaves, tasks, performance reviews, feedback). Uses Gemini AI via Inngest for long-running generation. Accessible to admins (org-wide) and heads of departments (department-scoped).

## Architecture

### Backend

#### 1. New Model: `AiInsight`

File: `backend/src/models/AiInsight.ts`

```ts
interface IAiInsight extends Document {
  // Who triggered it
  createdBy: ObjectId;         // ref User
  scope: "organization" | "department";
  department?: ObjectId | null; // ref Department — set when scope is "department"
  // Content
  status: "pending" | "generating" | "completed" | "failed";
  title?: string;               // AI-generated title
  content?: string;             // AI-generated markdown insights
  summary?: string;             // Short one-liner
  // Metadata
  period: string;               // e.g. "Last 30 days", "Q1 2026"
  inngestRunId?: string;        // For tracking Inngest execution
  error?: string;               // Error message if failed
}
```

Indexes: `{ createdBy: 1, createdAt: -1 }`, `{ scope: 1, createdAt: -1 }`

#### 2. Controller: `aiInsights.ts`

File: `backend/src/controllers/aiInsights.ts`

Endpoints:
- `POST /api/ai-insights/generate` — Creates an AiInsight doc (status: "pending"), dispatches Inngest event `ai/insight-generate`, returns the insight doc immediately. Heads can only generate for their own department.
- `GET /api/ai-insights` — Lists past insights scoped by role. Admin sees all org-wide. Head sees only their department's insights. Supports pagination.
- `GET /api/ai-insights/:id` — Get single insight detail.

#### 3. Route: `aiInsights.ts`

File: `backend/src/routes/aiInsights.ts`

```ts
router.use(requireAuth);
router.post("/generate", requireRole("admin", "head"), generateInsight);
router.get("/", requireRole("admin", "head"), listInsights);
router.get("/:id", requireRole("admin", "head"), getInsight);
```

Mount in `server.ts`: `app.use("/api/ai-insights", aiInsightsRouter);`

#### 4. Inngest Function: `generateInsight.ts`

File: `backend/src/inngest/functions/generateInsight.ts`

Event: `ai/insight-generate` with `{ insightId: string }`

Steps:
1. **Fetch insight doc** — load the AiInsight by ID, get the user's role and department
2. **Collect data** — aggregate from existing models:
   - Attendance: present/absent/late rates over last 30 days (or department-scoped)
   - Leaves: count by type, approval/rejection rates
   - Tasks: completion rate, overdue count, in-progress count
   - Performance reviews: average scores, distribution
   - Feedback: count by category, open vs resolved
   - For heads: filter all queries by department members
   - For admins: no department filter
3. **Build prompt** — Construct a comprehensive prompt with all the data, asking Gemini for:
   - Overall organizational/departmental health summary
   - Employee development recommendations
   - Team dynamics insights
   - Attendance pattern analysis
   - Task productivity insights
   - Actionable recommendations (top 3-5)
4. **Call Gemini** — Use same pattern as `generateReview.ts` (Gemini API with flash model)
5. **Save results** — Update the AiInsight doc with generated content, title, summary, status: "completed"
6. **Handle errors** — On any failure, update status to "failed" with error message

#### Register in `backend/src/inngest/index.ts`

Add `generateInsightFunction` to the functions array.

### Frontend

#### 5. Types

Add to `frontend/app/types.ts`:
```ts
interface AiInsight {
  _id: string;
  createdBy: Pick<User, "_id" | "name">;
  scope: "organization" | "department";
  department?: Pick<Department, "_id" | "name"> | null;
  status: "pending" | "generating" | "completed" | "failed";
  title?: string;
  content?: string;
  summary?: string;
  period: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

interface AiInsightListResponse {
  insights: AiInsight[];
  total: number;
  limit: number | null;
  offset: number;
}
```

#### 6. Hook: `use-ai-insights.ts`

File: `frontend/app/hooks/use-ai-insights.ts`

- `useInsights(params)` — query past insights
- `useGenerateInsight()` — mutation to trigger generation (POST /generate)

#### 7. Admin Page: `frontend/app/routes/admin/ai-insights.tsx`

- Header: "AI Insights" with description
- "Generate New Insight" button — opens a dialog to select period (last 30 days / last 90 days / custom)
- List of past insights as cards showing: title, summary, status badge, date
- Click to expand/view full insight content (rendered as formatted text)
- Loading/empty/error states
- Skeleton for loading state

#### 8. Head Page: `frontend/app/routes/ai-insights.tsx`

Same component structure as admin but:
- Shows only department-scoped insights
- Generates insights for their department only
- Added to "My workspace" nav group in sidebar

#### 9. Route Registration

In `frontend/app/routes.ts`:
- Add `route("ai-insights", "routes/ai-insights.tsx")` in the protected layout (alongside other employee/head routes)
- Add `route("ai-insights", "routes/admin/ai-insights.tsx")` in the admin prefix

#### 10. Sidebar Navigation

In `frontend/app/components/layout/app-sidebar.tsx`:
- Add to "My workspace" group (roles: employee, head): `{ title: "AI Insights", to: "/ai-insights", icon: Sparkles }`
- Add to "Administration" group (roles: admin): `{ title: "AI Insights", to: "/admin/ai-insights", icon: Sparkles }`

Use `Sparkles` from lucide-react as the icon.

### Data Model for AI Prompt

The Inngest function should gather and format:

```
## Attendance Data (Last 30 Days)
- Total employees: X
- Average attendance rate: X%
- Present: X days | Absent: X days | Late: X days
- Lowest attendance: [Employee] at X%

## Leave Data
- Total requests: X (Approved: X, Rejected: X, Pending: X)
- By type: Annual (X), Sick (X), Personal (X)
- Highest leave usage: [Employee] with X days

## Task Data
- Total tasks: X
- Completed: X | In Progress: X | Overdue: X
- Completion rate: X%
- Average time to complete: X days

## Performance Reviews
- Total reviews: X
- Average score: X/5
- Score distribution: 1★ (X) | 2★ (X) | 3★ (X) | 4★ (X) | 5★ (X)

## Feedback
- Total submissions: X
- Categories: Suggestion (X), Complaint (X), Praise (X)
- Resolution rate: X%
```

## Gemini Prompt Template

```
You are an expert HR analytics consultant. Analyze the following organizational data and provide actionable insights.

## Data
{formatted data}

## Instructions
Provide a comprehensive analysis with:
1. **Executive Summary** — 2-3 sentence overview of organizational/departmental health
2. **Key Findings** — 3-5 bullet points highlighting the most significant patterns
3. **Employee Development Recommendations** — specific actions for improving employee growth
4. **Team Dynamics Insights** — observations about collaboration, workload, and engagement
5. **Attendance & Productivity Analysis** — patterns in attendance and task completion
6. **Action Items** — 3-5 prioritized, actionable recommendations

Be data-driven, specific, and constructive. Reference actual numbers from the data.
Return ONLY a JSON object:
{
  "title": "<short descriptive title>",
  "summary": "<one-line summary>",
  "content": "<formatted markdown content with all sections>"
}
```

## Files to Create/Modify

### Create:
- `backend/src/models/AiInsight.ts`
- `backend/src/controllers/aiInsights.ts`
- `backend/src/routes/aiInsights.ts`
- `backend/src/inngest/functions/generateInsight.ts`
- `frontend/app/hooks/use-ai-insights.ts`
- `frontend/app/routes/admin/ai-insights.tsx`
- `frontend/app/routes/ai-insights.tsx`

### Modify:
- `backend/src/inngest/index.ts` — register new function
- `backend/src/server.ts` — mount new route
- `frontend/app/routes.ts` — add routes
- `frontend/app/components/layout/app-sidebar.tsx` — add nav items
- `frontend/app/types.ts` — add AiInsight types

## Done When

- [ ] Admin can generate org-wide AI insights from `/admin/ai-insights`
- [ ] Head can generate department-scoped AI insights from `/ai-insights`
- [ ] Insights are generated asynchronously via Inngest (status shows pending → generating → completed)
- [ ] Generated insights display formatted content with clear sections
- [ ] Past insights are listed with title, summary, date, and status
- [ ] Error states are handled gracefully (failed generation shows error message)
- [ ] Loading states show skeletons
- [ ] Empty state shown when no insights exist yet
- [ ] Navigation items appear correctly for each role
- [ ] TypeScript typecheck passes
