import { AppShell } from "@/components/layout/app-shell";
import { RequireAuth } from "@/components/auth/require-auth";

/**
 * Pathless layout wrapping every protected route. The auth guard runs before
 * any child renders; signed-out users are redirected to the login page.
 */
export default function ProtectedLayout() {
  return (
    <RequireAuth>
      <AppShell />
    </RequireAuth>
  );
}
