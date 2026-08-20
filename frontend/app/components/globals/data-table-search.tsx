import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

/**
 * Debounced search input for data tables. Reports the stable query (empty string
 * when cleared) via `onValueChange` — pair it with `usePagination({ resetKey })`
 * so the page resets to 1 as the user types.
 */
export function DataTableSearch({
  value,
  onValueChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState(value);
  const debounced = useDebouncedValue(query);

  // Keep the local input in sync when the parent resets `value` externally.
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Report the debounced query upward.
  useEffect(() => {
    onValueChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <InputGroup className={cn("w-full sm:max-w-xs", className)}>
      <InputGroupAddon align="inline-start" aria-hidden>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {query !== "" && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            <X />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
