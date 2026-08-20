import {
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  History,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Megaphone,
  MessageSquareText,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";

import { BrandMark } from "@/components/layout/brand";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import type { Role } from "@/types";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  employee: "Employee",
  head: "Head of Department",
};

interface NavItem {
  title: string;
  to: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  /** Omit for links every role sees. */
  roles?: Role[];
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "General",
    items: [{ title: "Dashboard", to: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "My workspace",
    roles: ["employee", "head"],
    items: [
      { title: "My Profile", to: "/profile", icon: UserRound },
      { title: "My Leave Requests", to: "/leaves", icon: CalendarDays },
      { title: "Attendance", to: "/attendance", icon: CalendarCheck },
      { title: "Announcements", to: "/announcements", icon: Megaphone },
      { title: "Feedback", to: "/feedback", icon: MessageSquareText },
      { title: "Performance Reviews", to: "/performance-reviews", icon: Trophy },
      { title: "Tasks", to: "/tasks", icon: ClipboardList },
      { title: "AI Insights", to: "/ai-insights", icon: Sparkles },
    ],
  },
  {
    label: "Administration",
    roles: ["admin"],
    items: [
      { title: "Manage Users", to: "/admin/users", icon: Users },
      { title: "Departments", to: "/admin/departments", icon: Building2 },
      { title: "Reports", to: "/admin/reports", icon: BarChart3 },
      { title: "Manage Leaves", to: "/admin/leaves", icon: CalendarClock },
      { title: "Attendance", to: "/attendance", icon: CalendarCheck },
      { title: "Activity Log", to: "/admin/activity-log", icon: History },
      { title: "Announcements", to: "/announcements", icon: Megaphone },
      { title: "Feedback", to: "/admin/feedback", icon: MessageSquareText },
      { title: "Performance Reviews", to: "/admin/performance-reviews", icon: Trophy },
      { title: "Tasks", to: "/admin/tasks", icon: ClipboardList },
      { title: "AI Insights", to: "/admin/ai-insights", icon: Sparkles },
    ],
  },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * App sidebar: role-gated navigation + user card + sign out.
 *
 * `RequireAuth` gates the layout before this renders, so the current user is
 * always available here.
 */
export function AppSidebar() {
  const { data: user } = useCurrentUser();
  const { pathname } = useLocation();
  const logout = useLogout();
  const navigate = useNavigate();

  if (!user) return null;

  const groups = NAV_GROUPS.filter(
    (group) => !group.roles || group.roles.includes(user.role)
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          to="/dashboard"
          className="flex items-center gap-2.5 px-1 py-1 outline-none rounded-lg focus-visible:ring-2 ring-sidebar-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <BrandMark className="size-8 rounded-lg" />
          <span className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-heading text-sm font-semibold">EMS</span>
            <span className="text-[0.68rem] text-sidebar-foreground/60">
              Employee Management System
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      render={<Link to={item.to} />}
                      isActive={pathname === item.to}
                      tooltip={item.title}
                      className="rounded-lg group-data-[collapsible=icon]:justify-center before:absolute before:top-1/2 before:left-0 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-sidebar-primary before:opacity-0 before:transition-opacity data-active:before:opacity-100 group-data-[collapsible=icon]:before:hidden"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0">
          <Avatar className="size-8">
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">{user.name}</span>
            <span className="truncate text-xs text-sidebar-foreground/60">
              {ROLE_LABELS[user.role]}
            </span>
          </span>
        </div>
        <Button
          variant="ghost"
          onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/") })}
          disabled={logout.isPending}
          className="w-full justify-start gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          {logout.isPending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <LogOut />
          )}
          <span className="group-data-[collapsible=icon]:hidden">
            {logout.isPending ? "Signing out…" : "Sign out"}
          </span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
