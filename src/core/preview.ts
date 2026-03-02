import { formatPreviewResult, formatQueryResult } from './formatter';
import { PreviewResult, QueryResult } from '../types/protocol';

export function buildPreview(
  table: string,
  rows: Record<string, unknown>[],
  totalCount: number | null,
  maxTextLength: number
): PreviewResult {
  return formatPreviewResult(table, rows, totalCount, maxTextLength);
}

export function buildQueryResult(
  rows: Record<string, unknown>[],
  columns: Array<{ name: string; type: string }>,
  maxTextLength: number
): QueryResult {
  return formatQueryResult(rows, columns, maxTextLength);
}
