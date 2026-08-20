import { type RouteConfig, index, layout, prefix, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  layout("routes/protected.tsx", [
    route("dashboard", "routes/dashboard.tsx"),
    route("profile", "routes/profile.tsx"),
    route("leaves", "routes/leaves.tsx"),
    route("announcements", "routes/announcements.tsx"),
    route("feedback", "routes/feedback.tsx"),
    route("attendance", "routes/attendance.tsx"),
    route("performance-reviews", "routes/performance-reviews.tsx"),
    route("tasks", "routes/tasks.tsx"),
    route("ai-insights", "routes/ai-insights.tsx"),
    ...prefix("admin", [
      route("users", "routes/admin/users.tsx"),
      route("departments", "routes/admin/departments.tsx"),
      route("reports", "routes/admin/reports.tsx"),
      route("leaves", "routes/admin/leaves.tsx"),
      route("feedback", "routes/admin/feedback.tsx"),
      route("activity-log", "routes/admin/activity-log.tsx"),
      route("performance-reviews", "routes/admin/performance-reviews.tsx"),
      route("tasks", "routes/admin/tasks.tsx"),
      route("ai-insights", "routes/admin/ai-insights.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
