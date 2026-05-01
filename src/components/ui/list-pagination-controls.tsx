"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

export type PaginationPageSize = 10 | 20 | 50;

export function useListPagination<T>(items: T[], initialPageSize: PaginationPageSize = 10, initialPage = 1) {
  const [pageSize, setPageSize] = useState<PaginationPageSize>(initialPageSize);
  const [requestedPage, setRequestedPage] = useState(initialPage);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(requestedPage, 1), totalPages);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [currentPage, items, pageSize]);

  const paginationStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const paginationEnd = totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems);

  return {
    pageSize,
    setPageSize: (value: PaginationPageSize) => {
      setPageSize(value);
      setRequestedPage(1);
    },
    currentPage,
    setCurrentPage: setRequestedPage,
    totalItems,
    totalPages,
    paginatedItems,
    paginationStart,
    paginationEnd,
    goToPreviousPage: () => setRequestedPage((page) => Math.max(1, Math.min(page, totalPages) - 1)),
    goToNextPage: () => setRequestedPage((page) => Math.min(totalPages, Math.max(page, 1) + 1)),
  };
}

export function ListPaginationControls({
  pageSize,
  setPageSize,
  currentPage,
  totalPages,
  totalItems,
  paginationStart,
  paginationEnd,
  goToPreviousPage,
  goToNextPage,
  summaryTestId,
  controlsTestId,
}: {
  pageSize: PaginationPageSize;
  setPageSize: (value: PaginationPageSize) => void;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  paginationStart: number;
  paginationEnd: number;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
  summaryTestId?: string;
  controlsTestId?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Filas visibles
        <select
          value={String(pageSize)}
          onChange={(event) => setPageSize(Number(event.target.value) as PaginationPageSize)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          aria-label="Filas visibles por página"
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
        </select>
      </label>
      <div className="text-sm text-muted-foreground" data-testid={summaryTestId}>
        Mostrando {paginationStart}-{paginationEnd} de {totalItems}
      </div>
      <div className="flex gap-2" data-testid={controlsTestId}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={goToPreviousPage}
          disabled={currentPage === 1 || totalItems === 0}
        >
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={goToNextPage}
          disabled={currentPage === totalPages || totalItems === 0}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
