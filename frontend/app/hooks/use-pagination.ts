import { useEffect, useState } from "react";

export interface UsePaginationOptions {
  limit: number;
  /** When this value changes the page resets to 1 (e.g. the debounced search string). */
  resetKey?: string;
}

/**
 * Page state for server-side pagination. Pages send `limit` + `offset` to their
 * TanStack Query hook, sync the returned `total` via `setTotal`, and pass
 * `page`/`total` to `<DataTablePagination />`.
 *
 * The page auto-resets to 1 when `resetKey` changes (a new search) and clamps to
 * the last valid page when the dataset shrinks (filter change, deletions), so the
 * table never sits on an empty page past the end.
 */
export function usePagination({ limit, resetKey }: UsePaginationOptions) {
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    if (total > 0) {
      const lastPage = Math.max(1, Math.ceil(total / limit));
      if (page > lastPage) setPage(lastPage);
    }
  }, [total, page, limit]);

  return {
    page,
    setPage,
    /** 0-based offset for the current page. */
    offset: (page - 1) * limit,
    limit,
    /** Total rows matching the current filter (sync from the query response). */
    total,
    setTotal,
    /** Jump back to page 1 (e.g. after a search change). */
    reset: () => setPage(1),
  };
}
