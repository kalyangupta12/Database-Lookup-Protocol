import { Pool, PoolConfig } from 'pg';
import { BaseAdapter } from './base';
import { TableInfo, PreviewResult, QueryResult, ColumnInfo } from '../types/protocol';
import { buildColumnInfo, buildTableInfo } from '../core/schema';
import { buildPreview, buildQueryResult } from '../core/preview';
import { sanitizeIdentifier } from '../core/validator';

export interface PostgresConfig extends PoolConfig {
  maxTextLength?: number;
}

export class PostgresAdapter extends BaseAdapter {
  private pool: Pool;

  constructor(config: PostgresConfig) {
    super(config.maxTextLength ?? 200);
    const { maxTextLength: _mt, ...poolConfig } = config;
    this.pool = new Pool(poolConfig);
  }

  async connect(): Promise<void> {
    const client = await this.pool.connect();
    await client.query('SELECT 1');
    client.release();
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  async getSchema(schemaFilter?: string): Promise<TableInfo[]> {
    const { rows: tableMeta } = await this.pool.query<{
      table_name: string;
      table_schema: string;
      table_type: string;
    }>(
      `SELECT table_name, table_schema,
              CASE WHEN table_type = 'VIEW' THEN 'view' ELSE 'table' END AS table_type
       FROM information_schema.tables
       WHERE table_schema NOT IN ('pg_catalog','information_schema','pg_toast')
         ${schemaFilter ? 'AND table_schema = $1' : ''}
       ORDER BY table_schema, table_name`,
      schemaFilter ? [schemaFilter] : []
    );

    const tables: TableInfo[] = [];
    for (const meta of tableMeta) {
      const cols = await this._getColumns(meta.table_name, meta.table_schema);
      const rowCount = await this._estimateCount(meta.table_name, meta.table_schema);
      tables.push(
        buildTableInfo({
          name: meta.table_name,
          schema: meta.table_schema === 'public' ? null : meta.table_schema,
          type: meta.table_type as 'table' | 'view',
          rowCount,
          columns: cols,
        })
      );
    }
    return tables;
  }

  async previewTable(table: string, limit: number, schema = 'public'): Promise<PreviewResult> {
    const safe = sanitizeIdentifier(table);
    const safeSchema = sanitizeIdentifier(schema);
    const { rows } = await this.pool.query(
      `SELECT * FROM "${safeSchema}"."${safe}" LIMIT $1`,
      [limit]
    );
    const countResult = await this.pool.query<{ count: string }>(
      `SELECT reltuples::bigint AS count FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relname = $1 AND n.nspname = $2`,
      [safe, safeSchema]
    );
    const totalCount = Number(countResult.rows[0]?.count ?? 0);
    return buildPreview(table, rows as Record<string, unknown>[], totalCount, this.maxTextLength);
  }

  async describeTable(table: string, schema = 'public'): Promise<TableInfo> {
    const cols = await this._getColumns(table, schema);
    const rowCount = await this._estimateCount(table, schema);
    return buildTableInfo({ name: table, schema, rowCount, columns: cols });
  }

  async safeQuery(query: string, maxRows: number): Promise<QueryResult> {
    const { rows, fields } = await this.pool.query(query);
    const limited = (rows as Record<string, unknown>[]).slice(0, maxRows);
    const columns = fields.map(f => ({ name: f.name, type: String(f.dataTypeID) }));
    return buildQueryResult(limited, columns, this.maxTextLength);
  }

  private async _getColumns(table: string, schema: string): Promise<ColumnInfo[]> {
    const { rows } = await this.pool.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      character_maximum_length: number | null;
      col_description: string | null;
    }>(
      `SELECT
        c.column_name, c.data_type, c.is_nullable,
        c.column_default, c.character_maximum_length,
        pg_catalog.col_description(pgc.oid, c.ordinal_position::int) AS col_description
      FROM information_schema.columns c
      LEFT JOIN pg_catalog.pg_class pgc
        ON pgc.relname = c.table_name
       AND pgc.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = c.table_schema)
      WHERE c.table_name = $1 AND c.table_schema = $2
      ORDER BY c.ordinal_position`,
      [table, schema]
    );

    const { rows: pkRows } = await this.pool.query<{ column_name: string }>(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_name = $1 AND tc.table_schema = $2`,
      [table, schema]
    );
    const pkCols = new Set(pkRows.map(r => r.column_name));

    const { rows: fkRows } = await this.pool.query<{ column_name: string }>(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_name = $1 AND tc.table_schema = $2`,
      [table, schema]
    );
    const fkCols = new Set(fkRows.map(r => r.column_name));

    return rows.map(r =>
      buildColumnInfo({
        name: r.column_name,
        type: r.data_type,
        nullable: r.is_nullable === 'YES',
        isPrimaryKey: pkCols.has(r.column_name),
        isForeignKey: fkCols.has(r.column_name),
        defaultValue: r.column_default,
        maxLength: r.character_maximum_length,
        comment: r.col_description,
      })
    );
  }

  private async _estimateCount(table: string, schema: string): Promise<number | null> {
    const { rows } = await this.pool.query<{ count: string }>(
      `SELECT reltuples::bigint AS count FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relname = $1 AND n.nspname = $2`,
      [table, schema]
    );
    return rows[0] ? Number(rows[0].count) : null;
  }
}
