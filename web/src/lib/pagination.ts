export function getPageCount(totalItems: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function clampPage(page: number, totalItems: number, pageSize: number): number {
  const pageCount = getPageCount(totalItems, pageSize);
  return Math.min(Math.max(page, 0), pageCount - 1);
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const safePage = clampPage(page, items.length, pageSize);
  const start = safePage * pageSize;
  return items.slice(start, start + pageSize);
}
