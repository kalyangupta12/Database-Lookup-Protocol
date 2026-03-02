// Public library API — consumers import from here
export type { DLPAdapter } from './adapters/base';
export { BaseAdapter } from './adapters/base';
export { PostgresAdapter } from './adapters/postgres';
export type { PostgresConfig } from './adapters/postgres';
export { MySQLAdapter } from './adapters/mysql';
export type { MySQLConfig } from './adapters/mysql';
export { MongoDBAdapter } from './adapters/mongodb';
export type { MongoDBConfig } from './adapters/mongodb';
export { MSSQLAdapter } from './adapters/mssql';
export type { MSSQLConfig } from './adapters/mssql';
export { PrismaAdapter } from './adapters/prisma';

export type {
  DLPRequest,
  DLPConfig,
  DBType,
  DLPError,
  TableInfo,
  ColumnInfo,
  PreviewResult,
  QueryResult,
} from './types/protocol';

export {
  DLPRequestSchema,
  GetSchemaRequestSchema,
  PreviewTableRequestSchema,
  DescribeTableRequestSchema,
  SafeQueryRequestSchema,
} from './types/protocol';

export { createApp, startHttpServer } from './server/index';
export { startMCPServer } from './mcp/server';
export { validateSafeQuery, sanitizeIdentifier, extractLimit } from './core/validator';
export { compactTableInfo, formatPreviewResult, formatQueryResult } from './core/formatter';
export { buildColumnInfo, buildTableInfo, normalizeType } from './core/schema';
