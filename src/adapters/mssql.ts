import * as sql from 'mssql';
import { BaseAdapter } from './base';
import { TableInfo, PreviewResult, QueryResult, ColumnInfo } from '../types/protocol';
import { buildColumnInfo, buildTableInfo } from '../core/schema';
import { buildPreview, buildQueryResult } from '../core/preview';
import { sanitizeIdentifier } from '../core/validator';

export interface MSSQLConfig {
  server: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  maxTextLength?: number;
}

export class MSSQLAdapter extends BaseAdapter {
  private pool!: sql.ConnectionPool;
  private config: MSSQLConfig;

  constructor(config: MSSQLConfig) {
    super(config.maxTextLength ?? 200);
    this.config = config;
  }

  async connect(): Promise<void> {
    this.pool = await sql.connect({
      server: this.config.server,
      port: this.config.port ?? 1433,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      options: {
        encrypt: this.config.encrypt ?? true,
        trustServerCertificate: this.config.trustServerCertificate ?? false,
      },
    });
  }

  async disconnect(): Promise<void> {
    await this.pool.close();
  }

  async getSchema(schemaFilter?: string): Promise<TableInfo[]> {
    const result = await this.pool.request().query(`
      SELECT TABLE_NAME, TABLE_SCHEMA, TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW')
        ${schemaFilter ? `AND TABLE_SCHEMA = '${schemaFilter.replace(/'/g, "''")}'` : ''}
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);

    const tables: TableInfo[] = [];
    for (const meta of result.recordset as sql.IRecordSet<{
      TABLE_NAME: string;
      TABLE_SCHEMA: string;
      TABLE_TYPE: string;
    }>) {
      const cols = await this._getColumns(meta.TABLE_NAME, meta.TABLE_SCHEMA);
      const rowCount = await this._estimateCount(meta.TABLE_NAME, meta.TABLE_SCHEMA);
      tables.push(
        buildTableInfo({
          name: meta.TABLE_NAME,
          schema: meta.TABLE_SCHEMA !== 'dbo' ? meta.TABLE_SCHEMA : null,
          type: meta.TABLE_TYPE === 'VIEW' ? 'view' : 'table',
          rowCount,
          columns: cols,
        })
      );
    }
    return tables;
  }

  async previewTable(table: string, limit: number, schema = 'dbo'): Promise<PreviewResult> {
    const safe = sanitizeIdentifier(table);
    const safeSchema = sanitizeIdentifier(schema);
    const result = await this.pool
      .request()
      .query(`SELECT TOP ${limit} * FROM [${safeSchema}].[${safe}]`);
    const countResult = await this.pool
      .request()
      .query(`SELECT COUNT(*) AS cnt FROM [${safeSchema}].[${safe}]`);
    const totalCount: number = (countResult.recordset[0] as { cnt: number })?.cnt ?? 0;
    return buildPreview(
      table,
      result.recordset as Record<string, unknown>[],
      totalCount,
      this.maxTextLength
    );
  }

  async describeTable(table: string, schema = 'dbo'): Promise<TableInfo> {
    const cols = await this._getColumns(table, schema);
    const rowCount = await this._estimateCount(table, schema);
    return buildTableInfo({ name: table, schema, rowCount, columns: cols });
  }

  async safeQuery(query: string, maxRows: number): Promise<QueryResult> {
    const result = await this.pool.request().query(query);
    const limited = (result.recordset as Record<string, unknown>[]).slice(0, maxRows);
    const columns =
      limited.length > 0
        ? Object.keys(limited[0]).map(k => ({ name: k, type: 'unknown' }))
        : [];
    return buildQueryResult(limited, columns, this.maxTextLength);
  }

  private async _getColumns(table: string, schema: string): Promise<ColumnInfo[]> {
    const result = await this.pool
      .request()
      .input('table', sql.VarChar, table)
      .input('schema', sql.VarChar, schema).query(`
        SELECT
          c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE, c.COLUMN_DEFAULT,
          c.CHARACTER_MAXIMUM_LENGTH,
          CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PK
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN (
          SELECT kcu.COLUMN_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
            ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
          WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
            AND tc.TABLE_NAME = @table AND tc.TABLE_SCHEMA = @schema
        ) pk ON pk.COLUMN_NAME = c.COLUMN_NAME
        WHERE c.TABLE_NAME = @table AND c.TABLE_SCHEMA = @schema
        ORDER BY c.ORDINAL_POSITION
      `);

    return (
      result.recordset as Array<{
        COLUMN_NAME: string;
        DATA_TYPE: string;
        IS_NULLABLE: string;
        COLUMN_DEFAULT: string | null;
        CHARACTER_MAXIMUM_LENGTH: number | null;
        IS_PK: number;
      }>
    ).map(r =>
      buildColumnInfo({
        name: r.COLUMN_NAME,
        type: r.DATA_TYPE,
        nullable: r.IS_NULLABLE === 'YES',
        isPrimaryKey: r.IS_PK === 1,
        defaultValue: r.COLUMN_DEFAULT,
        maxLength:
          r.CHARACTER_MAXIMUM_LENGTH != null ? Number(r.CHARACTER_MAXIMUM_LENGTH) : null,
      })
    );
  }

  private async _estimateCount(table: string, schema: string): Promise<number | null> {
    const r = await this.pool
      .request()
      .input('t', sql.VarChar, table)
      .input('s', sql.VarChar, schema).query(`
        SELECT SUM(p.rows) AS cnt
        FROM sys.tables t
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        JOIN sys.partitions p ON t.object_id = p.object_id
        WHERE t.name = @t AND s.name = @s AND p.index_id IN (0,1)
      `);
    const cnt = (r.recordset[0] as { cnt: number | null } | undefined)?.cnt;
    return cnt != null ? Number(cnt) : null;
  }
}
