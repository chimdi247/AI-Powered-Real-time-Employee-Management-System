import { Outlet } from "react-router";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useNotificationSSE } from "@/hooks/use-notifications";

/**
 * Chrome around every protected page: collapsible sidebar (icon rail on
 * desktop, Sheet on mobile) + a slim header with the sidebar trigger.
 * Pages render their own content below the header.
 */
export function AppShell() {
  // Initialize SSE connection for real-time notifications.
  useNotificationSSE();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </header>
        <div className="flex-1">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
