# Performance Review System

## Goal

Implement a full performance review system where admins and heads of departments can schedule reviews, provide feedback with ratings, set goals — and AI (Gemini) generates structured performance reviews. Runs as a background Inngest function. Employees can view, acknowledge, and track progress.

## Data Model

### `backend/src/models/PerformanceReview.ts`

```ts
interface IPerformanceReview extends mongoose.Document {
  employee: ObjectId;          // ref User
  reviewer: ObjectId;          // ref User (admin or head)
  period: string;              // e.g. "Q1 2026", "2025"
  status: "draft" | "pending_acknowledgment" | "acknowledged" | "completed";
  ratings: {
    category: string;          // "Communication", "Technical Skills", "Teamwork", "Leadership"
    score: number;             // 1-5
    comment?: string;
  }[];
  overallScore?: number;       // computed, 1-5
  strengths?: string;          // AI-generated
  improvements?: string;       // AI-generated
  summary?: string;            // AI-generated overall narrative
  goals: {
    title: string;
    description?: string;
    status: "not_started" | "in_progress" | "completed";
    dueDate?: Date;
    completedAt?: Date;
  }[];
  employeeComments?: string;   // employee acknowledgment notes
  acknowledgedAt?: Date;
  aiGenerated: boolean;        // whether AI generated the review content
}
```

Indexes: `{ employee: 1, createdAt: -1 }`, `{ reviewer: 1, createdAt: -1 }`, `{ status: 1 }`

### Notification type additions (`backend/src/models/Notification.ts`)

Add to NOTIFICATION_TYPES: `"review_assigned"`, `"review_acknowledged"`

### Activity action additions (`backend/src/models/ActivityLog.ts`)

Add to ACTIVITY_ACTIONS: `"review_created"`, `"review_generated"`, `"review_acknowledged"`, `"review_completed"`, `"goal_updated"`

## Backend API

### `backend/src/controllers/performanceReviews.ts`

Endpoints:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/performance-reviews` | admin, head | Create a review (triggers AI generation via Inngest) |
| GET | `/api/performance-reviews` | admin, head | List all reviews (filterable by employee, status, period) |
| GET | `/api/performance-reviews/mine` | employee | Employee's own reviews |
| GET | `/api/performance-reviews/:id` | owner or admin/head | Get single review |
| PATCH | `/api/performance-reviews/:id` | admin, head | Update review (ratings, goals, feedback) |
| POST | `/api/performance-reviews/:id/acknowledge` | employee (owner) | Employee acknowledges review |
| PATCH | `/api/performance-reviews/:id/goals/:goalIndex` | admin, head | Update goal status |

### `backend/src/routes/performanceReviews.ts`

Follow the same pattern as leaves/feedback routes. Use `requireAuth` + `requireRole`.

## Inngest Function

### `backend/src/inngest/functions/generateReview.ts`

This is the core AI function:

```ts
// Event: "performance/generate-review"
// Payload: { reviewId: string }
// Steps:
//   1. Fetch the PerformanceReview + employee data (name, department, past reviews)
//   2. Call Gemini API (model: gemini-2.0-flash) with a prompt that:
//      - Takes the ratings and comments as input
//      - Generates: overallScore, strengths, improvements, summary
//      - Returns structured JSON
//   3. Parse the JSON response and update the review document
//   4. Update status to "pending_acknowledgment"
//   5. Notify the employee
```

### Gemini API call pattern

```ts
// Use fetch to call Gemini REST API directly (no SDK needed):
// POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=GEMINI_API_KEY
// Body: { contents: [{ parts: [{ text: prompt }] }] }
// Parse response.candidates[0].content.parts[0].text as JSON
```

### Prompt for Gemini

Construct a prompt that includes:
- Employee name, department, review period
- All category ratings with comments
- Previous review summaries (if any)
- Ask Gemini to return a JSON object with: `{ overallScore, strengths, improvements, summary }`

### Update `backend/src/inngest/index.ts`

Import and export the generateReview function in the functions array.

## Server Changes

### `backend/src/server.ts`

Add: `import performanceReviewsRouter from "./routes/performanceReviews.js";`
Mount: `app.use("/api/performance-reviews", performanceReviewsRouter);`

## Email Notifications

Add to `backend/src/lib/email.ts`:
- `reviewAssignedTemplate` — sent when a review is created/assigned
- `reviewCompletedTemplate` — sent when AI generation completes

Add to `backend/src/lib/notifications.ts`:
- Handle `"review_assigned"` and `"review_acknowledged"` types in `sendEmailForNotification`

## Frontend

### `frontend/app/lib/performance-review.ts`

API client functions:
- `getMyReviews(params?)` — GET `/performance-reviews/mine`
- `getReview(id)` — GET `/performance-reviews/:id`
- `getReviews(params)` — GET `/performance-reviews` (admin/head)
- `createReview(data)` — POST `/performance-reviews`
- `updateReview(id, data)` — PATCH `/performance-reviews/:id`
- `acknowledgeReview(id, data?)` — POST `/performance-reviews/:id/acknowledge`
- `updateGoal(reviewId, goalIndex, data)` — PATCH `/performance-reviews/:id/goals/:goalIndex`

### `frontend/app/routes/performance-reviews.tsx`

Employee view:
- List of their reviews with status badges
- Review detail view with ratings display, goals tracking
- Acknowledge button

### `frontend/app/routes/admin/performance-reviews.tsx`

Admin/head view:
- List all reviews with filters (employee, status, period)
- Create review dialog (select employee, period)
- Review detail with editable ratings and goals
- AI generate button (sends event to Inngest, shows loading state)

### Components to create in `frontend/app/components/`

- `performance-reviews/review-card.tsx` — review summary card
- `performance-reviews/rating-display.tsx` — star/category rating display
- `performance-reviews/goal-tracker.tsx` — goal list with status toggles
- `frontend/app/components/globals/star-rating.tsx` — reusable star rating input/display

## Implementation Order

1. Model → `PerformanceReview.ts`
2. Update `Notification.ts` and `ActivityLog.ts` with new types
3. Controller → `performanceReviews.ts`
4. Route → `performanceReviews.ts`
5. Update `server.ts`
6. Inngest function → `generateReview.ts` + update `inngest/index.ts`
7. Email templates + notification handlers
8. Frontend API lib
9. Frontend routes + components

## Key Conventions

- All local imports end with `.js` (Vercel deployment)
- Use `logActivity()` for all state changes
- Use `notify()` for employee notifications
- Follow existing controller patterns (parsePagination, searchRegex, param helpers)
- Roles: `admin` = full access, `head` = can create/manage reviews for their department, `employee` = view + acknowledge own

## Verification

- `bun run typecheck` passes (backend)
- All new endpoints are protected by auth + role middleware
- AI generation runs as background Inngest function (not blocking the API response)
