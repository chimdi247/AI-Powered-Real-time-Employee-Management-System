import { Building2 } from "lucide-react";

import { cn } from "@/lib/utils";

/** Rounded brand mark — used on the login page and in the app sidebar. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground text-primary shadow-sm ring-1 ring-foreground/10",
        className
      )}
    >
      <Building2 className="size-5" />
    </span>
  );
}

/** Brand mark + wordmark. Inherits text color from its parent. */
export function BrandHeader({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark />
      <div className="leading-tight">
        <p className="font-heading text-base font-semibold">EMS</p>
        <p className="text-xs opacity-70">Employee Management System</p>
      </div>
    </div>
  );
}
