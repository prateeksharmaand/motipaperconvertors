import { keepPreviousData } from "@tanstack/react-query";

// Re-export for convenience — use this in all useQuery calls that paginate
export { keepPreviousData };

export interface PagedResult<T = Record<string, unknown>> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
