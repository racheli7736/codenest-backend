export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function toSkipTake(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}

export function buildPage<T>(items: T[], total: number, page: number, limit: number): Page<T> {
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}
