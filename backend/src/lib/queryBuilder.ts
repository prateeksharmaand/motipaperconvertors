import type { Knex } from "knex";
import type { Request } from "express";

export interface ListParams {
  page: number;
  limit: number;
  search: string | null;
  sortBy: string;
  sortDir: "asc" | "desc";
  [key: string]: unknown; // additional filters
}

export interface ListResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Parse standard list query params from a request
export function parseListParams(
  req: Request,
  defaults: { sortBy: string; limit?: number } = { sortBy: "created_at" },
): ListParams {
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? String(defaults.limit ?? 20)) || 20));
  const search = (req.query.search as string)?.trim() || null;
  const sortBy = (req.query.sortBy as string) || defaults.sortBy;
  const sortDir = (req.query.sortDir as string) === "asc" ? "asc" : "desc";

  return { page, limit, search, sortBy, sortDir };
}

// Apply pagination + sort to any knex query, return paginated result
export async function paginate<T = Record<string, unknown>>(
  query: Knex.QueryBuilder,
  countQuery: Knex.QueryBuilder,
  params: ListParams,
  allowedSortColumns: string[],
  tableAlias?: string,
): Promise<ListResult<T>> {
  const safeSortBy = allowedSortColumns.includes(params.sortBy)
    ? (tableAlias ? `${tableAlias}.${params.sortBy}` : params.sortBy)
    : (tableAlias ? `${tableAlias}.${allowedSortColumns[0]}` : allowedSortColumns[0]);

  const data = await query
    .orderBy(safeSortBy, params.sortDir)
    .limit(params.limit)
    .offset((params.page - 1) * params.limit);

  const [{ count }] = await countQuery.count("* as count");
  const total = Number(count);

  return {
    data: data as T[],
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

// Apply a multi-column ILIKE search to a query
export function applySearch(
  query: Knex.QueryBuilder,
  search: string | null,
  columns: string[],
): Knex.QueryBuilder {
  if (!search) return query;
  return query.where((builder) => {
    for (const col of columns) {
      builder.orWhereILike(col, `%${search}%`);
    }
  });
}
