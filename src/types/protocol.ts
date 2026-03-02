import { z } from 'zod';

// ── Column / Field descriptor ────────────────────────────────────────────────
export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isIndexed: boolean;
  defaultValue: string | null;
  maxLength: number | null;
  comment: string | null;
}

// ── Table / Collection descriptor ───────────────────────────────────────────
export interface TableInfo {
  name: string;
  schema: string | null;
  type: 'table' | 'view' | 'collection' | 'materialized_view';
  rowCount: number | null;
  columns: ColumnInfo[];
}

// ── Preview result ───────────────────────────────────────────────────────────
export interface PreviewResult {
  table: string;
  rows: Record<string, unknown>[];
  totalCount: number | null;
  returnedCount: number;
  truncatedFields: string[];
}

// ── Query result ─────────────────────────────────────────────────────────────
export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  truncatedFields: string[];
  columns: Array<{ name: string; type: string }>;
}

// ── Protocol request schemas (Zod validated) ─────────────────────────────────
export const GetSchemaRequestSchema = z.object({
  action: z.literal('get_schema'),
  schema: z.string().optional(), // filter to a single schema (e.g. "public")
});

export const PreviewTableRequestSchema = z.object({
  action: z.literal('preview_table'),
  table: z.string().min(1).max(128),
  limit: z.number().int().min(1).max(20).default(5),
  schema: z.string().optional(),
});

export const DescribeTableRequestSchema = z.object({
  action: z.literal('describe_table'),
  table: z.string().min(1).max(128),
  schema: z.string().optional(),
});

export const SafeQueryRequestSchema = z.object({
  action: z.literal('safe_query'),
  query: z.string().min(1).max(4096),
});

export const DLPRequestSchema = z.discriminatedUnion('action', [
  GetSchemaRequestSchema,
  PreviewTableRequestSchema,
  DescribeTableRequestSchema,
  SafeQueryRequestSchema,
]);

export type DLPRequest = z.infer<typeof DLPRequestSchema>;
export type GetSchemaRequest = z.infer<typeof GetSchemaRequestSchema>;
export type PreviewTableRequest = z.infer<typeof PreviewTableRequestSchema>;
export type DescribeTableRequest = z.infer<typeof DescribeTableRequestSchema>;
export type SafeQueryRequest = z.infer<typeof SafeQueryRequestSchema>;

// ── Error response ───────────────────────────────────────────────────────────
export interface DLPError {
  error: string;
  code:
    | 'VALIDATION_ERROR'
    | 'SQL_INJECTION'
    | 'WRITE_OPERATION'
    | 'MISSING_LIMIT'
    | 'ADAPTER_ERROR'
    | 'AUTH_ERROR'
    | 'NOT_FOUND'
    | 'DB_ERROR';
  details?: unknown;
}

// ── Config ───────────────────────────────────────────────────────────────────
export type DBType = 'postgres' | 'mysql' | 'mongodb' | 'mssql' | 'prisma';

export interface DLPConfig {
  dbType: DBType;
  port: number;
  localhostOnly: boolean;
  apiKey: string;
  maxRows: number;
  defaultPreviewRows: number;
  maxTextLength: number;
}
