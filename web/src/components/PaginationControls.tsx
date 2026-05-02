import { ChevronLeft, ChevronRight } from "lucide-react";

function pageNumbers(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index);
  }

  const pages = new Set<number>([0, totalPages - 1, currentPage]);

  if (currentPage > 0) pages.add(currentPage - 1);
  if (currentPage < totalPages - 1) pages.add(currentPage + 1);

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const page = sorted[index];
    const previous = sorted[index - 1];

    if (index > 0 && previous !== undefined && page - previous > 1) {
      result.push("ellipsis");
    }

    result.push(page);
  }

  return result;
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  itemLabel,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}) {
  if (totalItems === 0) {
    return null;
  }

  const rangeStart = currentPage * pageSize + 1;
  const rangeEnd = Math.min(totalItems, (currentPage + 1) * pageSize);
  const visiblePages = pageNumbers(currentPage, totalPages);

  return (
    <nav
      aria-label={`${itemLabel} pagination`}
      className="mt-5 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between"
    >
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        Showing {rangeStart}-{rangeEnd} of {totalItems} {itemLabel}
      </p>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={currentPage === 0}
            onClick={() => onPageChange(currentPage - 1)}
            type="button"
          >
            <ChevronLeft size={16} />
            Previous
          </button>

          {visiblePages.map((page, index) =>
            page === "ellipsis" ? (
              <span className="px-2 text-sm font-bold text-slate-400" key={`ellipsis-${index}`}>
                ...
              </span>
            ) : (
              <button
                aria-current={page === currentPage ? "page" : undefined}
                className={`h-10 min-w-10 rounded-xl px-3 text-sm font-black transition ${
                  page === currentPage
                    ? "bg-slate-950 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                key={page}
                onClick={() => onPageChange(page)}
                type="button"
              >
                {page + 1}
              </button>
            ),
          )}

          <button
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={currentPage >= totalPages - 1}
            onClick={() => onPageChange(currentPage + 1)}
            type="button"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      ) : null}
    </nav>
  );
}
