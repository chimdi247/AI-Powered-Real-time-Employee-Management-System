import { toast } from "@/components/ui/toast";

/**
 * Convenience wrapper around the Base UI toast manager.
 * Provides simple `success()`, `error()`, `info()`, and `warning()` methods
 * that create styled toasts with a title and auto-dismiss.
 */
export function useToast() {
  return {
    success: (message: string) =>
      toast.add({ type: "success", title: message }),
    error: (message: string) =>
      toast.add({ type: "error", title: message }),
    info: (message: string) =>
      toast.add({ type: "info", title: message }),
    warning: (message: string) =>
      toast.add({ type: "warning", title: message }),
  };
}
