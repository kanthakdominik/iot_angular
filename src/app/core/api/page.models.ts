/** Common shape of paginated responses (V2.1-SPEC §3.0). */
export interface Page<T> {
  readonly content: T[];
  /** Zero-based page index. */
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}

/** `page` (from 0) and `size` (default 24, max 100) parameters. */
export interface PageQuery {
  readonly page?: number;
  readonly size?: number;
}
