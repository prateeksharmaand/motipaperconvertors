import { useState, useCallback } from "react";

export interface ListState {
  page: number;
  limit: number;
  search: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  filters: Record<string, string>;
}

export interface ListStateActions {
  setPage: (p: number) => void;
  setSearch: (s: string) => void;
  setSort: (col: string) => void;
  setFilter: (key: string, value: string) => void;
  resetFilters: () => void;
  toParams: () => Record<string, string>;
}

export function useListState(defaults: { sortBy: string; limit?: number; filters?: Record<string, string> }): [ListState, ListStateActions] {
  const [state, setState] = useState<ListState>({
    page: 1,
    limit: defaults.limit ?? 20,
    search: "",
    sortBy: defaults.sortBy,
    sortDir: "desc",
    filters: defaults.filters ?? {},
  });

  const setPage = useCallback((page: number) => setState((s) => ({ ...s, page })), []);

  const setSearch = useCallback((search: string) => setState((s) => ({ ...s, search, page: 1 })), []);

  const setSort = useCallback((col: string) => setState((s) => ({
    ...s,
    sortBy: col,
    sortDir: s.sortBy === col && s.sortDir === "asc" ? "desc" : "asc",
    page: 1,
  })), []);

  const setFilter = useCallback((key: string, value: string) =>
    setState((s) => ({ ...s, filters: { ...s.filters, [key]: value }, page: 1 })), []);

  const resetFilters = useCallback(() =>
    setState((s) => ({ ...s, filters: {}, search: "", page: 1 })), []);

  const toParams = useCallback((): Record<string, string> => {
    const p: Record<string, string> = {
      page: String(state.page),
      limit: String(state.limit),
      sortBy: state.sortBy,
      sortDir: state.sortDir,
    };
    if (state.search) p.search = state.search;
    for (const [k, v] of Object.entries(state.filters)) {
      if (v) p[k] = v;
    }
    return p;
  }, [state]);

  return [state, { setPage, setSearch, setSort, setFilter, resetFilters, toParams }];
}
