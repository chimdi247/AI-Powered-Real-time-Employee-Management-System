import type { LucideIcon } from "lucide-react";

/**
 * Intentional empty state for sections that exist in the navigation but aren't
 * built yet. Keeps every nav link functional instead of 404ing.
 */
export function PagePlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-border">
        <Icon className="size-5" />
      </div>
      <h2 className="mt-4 font-heading text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
