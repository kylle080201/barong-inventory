'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Client-side pagination over an in-memory list.
 * Resets to page 1 whenever any value in `resetKeys` changes (e.g. filters),
 * and clamps the page if the list shrinks (e.g. after a delete).
 */
export function usePagination<T>(items: T[], pageSize: number, resetKeys: unknown[] = []) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetKeys);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;

  return {
    page: currentPage,
    pageCount,
    setPage,
    start,
    end: Math.min(start + pageSize, items.length),
    total: items.length,
    pageItems: items.slice(start, start + pageSize),
  };
}

function pageNumbers(page: number, pageCount: number): (number | 'gap')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = Array.from(pages).filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const result: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('gap');
    result.push(p);
  });
  return result;
}

interface PaginationProps {
  page: number;
  pageCount: number;
  start: number;
  end: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageCount, start, end, total, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col items-center gap-3 pt-4 sm:flex-row sm:justify-between"
    >
      <p className="text-sm text-muted-foreground">
        Showing {start + 1}–{end} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <div className="hidden items-center gap-1 sm:flex">
          {pageNumbers(page, pageCount).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-2 text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={p}
                type="button"
                variant={p === page ? 'default' : 'ghost'}
                size="sm"
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            )
          )}
        </div>
        <span className="px-2 text-sm text-muted-foreground sm:hidden">
          {page} / {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
