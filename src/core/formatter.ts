import { PreviewResult, QueryResult, TableInfo } from '../types/protocol';

const DEFAULT_MAX_TEXT = 200;

export function truncateValue(
  value: unknown,
  maxLength = DEFAULT_MAX_TEXT
): { value: unknown; truncated: boolean } {
  if (typeof value === 'string' && value.length > maxLength) {
    return { value: value.slice(0, maxLength) + '…', truncated: true };
  }
  if (Buffer.isBuffer(value)) {
    return { value: `<Buffer ${value.length} bytes>`, truncated: true };
  }
  return { value, truncated: false };
}

export function truncateRow(
  row: Record<string, unknown>,
  maxLength: number
): { row: Record<string, unknown>; truncatedFields: string[] } {
  const result: Record<string, unknown> = {};
  const truncatedFields: string[] = [];

  for (const [key, val] of Object.entries(row)) {
    const { value, truncated } = truncateValue(val, maxLength);
    result[key] = value;
    if (truncated) truncatedFields.push(key);
  }

  return { row: result, truncatedFields };
}

export function formatPreviewResult(
  table: string,
  rows: Record<string, unknown>[],
  totalCount: number | null,
  maxLength: number
): PreviewResult {
  const processedRows: Record<string, unknown>[] = [];
  const allTruncatedFields = new Set<string>();

  for (const row of rows) {
    const { row: processed, truncatedFields } = truncateRow(row, maxLength);
    processedRows.push(processed);
    truncatedFields.forEach(f => allTruncatedFields.add(f));
  }

  return {
    table,
    rows: processedRows,
    totalCount,
    returnedCount: processedRows.length,
    truncatedFields: Array.from(allTruncatedFields),
  };
}

export function formatQueryResult(
  rows: Record<string, unknown>[],
  columns: Array<{ name: string; type: string }>,
  maxLength: number
): QueryResult {
  const processedRows: Record<string, unknown>[] = [];
  const allTruncatedFields = new Set<string>();

  for (const row of rows) {
    const { row: processed, truncatedFields } = truncateRow(row, maxLength);
    processedRows.push(processed);
    truncatedFields.forEach(f => allTruncatedFields.add(f));
  }

  return {
    rows: processedRows,
    rowCount: processedRows.length,
    truncatedFields: Array.from(allTruncatedFields),
    columns,
  };
}

// Compact schema for token efficiency — drops nulls and falsy defaults
export function compactTableInfo(tables: TableInfo[]): unknown {
  return tables.map(t => ({
    name: t.name,
    ...(t.schema ? { schema: t.schema } : {}),
    type: t.type,
    ...(t.rowCount !== null ? { rowCount: t.rowCount } : {}),
    columns: t.columns.map(c => ({
      name: c.name,
      type: c.type,
      ...(c.nullable ? { nullable: true } : {}),
      ...(c.isPrimaryKey ? { pk: true } : {}),
      ...(c.isForeignKey ? { fk: true } : {}),
      ...(c.isIndexed ? { indexed: true } : {}),
      ...(c.defaultValue !== null ? { default: c.defaultValue } : {}),
      ...(c.maxLength !== null ? { maxLength: c.maxLength } : {}),
      ...(c.comment !== null ? { comment: c.comment } : {}),
    })),
  }));
}
