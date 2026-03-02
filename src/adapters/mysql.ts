// eslint-disable-next-line @typescript-eslint/no-require-imports
import mysql = require('mysql2/promise');
import { BaseAdapter } from './base';
import { TableInfo, PreviewResult, QueryResult, ColumnInfo } from '../types/protocol';
import { buildColumnInfo, buildTableInfo } from '../core/schema';
import { buildPreview, buildQueryResult } from '../core/preview';
import { sanitizeIdentifier } from '../core/validator';

export interface MySQLConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  maxTextLength?: number;
}

export class MySQLAdapter extends BaseAdapter {
  private pool: mysql.Pool;
  private database: string;

  constructor(config: MySQLConfig) {
    super(config.maxTextLength ?? 200);
    this.database = config.database;
    this.pool = mysql.createPool({
      host: config.host,
      port: config.port ?? 3306,
      database: config.database,
      user: config.user,
      password: config.password,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }

  async connect(): Promise<void> {
    const conn = await this.pool.getConnection();
    await conn.query('SELECT 1');
    conn.release();
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  async getSchema(_schemaFilter?: string): Promise<TableInfo[]> {
    const [tableMeta] = await this.pool.query(
      `SELECT TABLE_NAME, TABLE_TYPE, TABLE_ROWS
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE IN ('BASE TABLE','VIEW')
       ORDER BY TABLE_NAME`,
      [this.database]
    );

    const tables: TableInfo[] = [];
    for (const meta of tableMeta as mysql.RowDataPacket[]) {
      const cols = await this._getColumns(String(meta['TABLE_NAME']));
      tables.push(
        buildTableInfo({
          name: String(meta['TABLE_NAME']),
          schema: null,
          type: meta['TABLE_TYPE'] === 'VIEW' ? 'view' : 'table',
          rowCount: meta['TABLE_ROWS'] !== null ? Number(meta['TABLE_ROWS']) : null,
          columns: cols,
        })
      );
    }
    return tables;
  }

  async previewTable(table: string, limit: number): Promise<PreviewResult> {
    const safe = sanitizeIdentifier(table);
    const [rows] = await this.pool.query(`SELECT * FROM \`${safe}\` LIMIT ?`, [limit]);
    const [countRows] = await this.pool.query(
      `SELECT COUNT(*) as count FROM \`${safe}\``
    );
    const totalCount = Number((countRows as mysql.RowDataPacket[])[0]?.['count'] ?? 0);
    return buildPreview(
      table,
      rows as Record<string, unknown>[],
      totalCount,
      this.maxTextLength
    );
  }

  async describeTable(table: string): Promise<TableInfo> {
    const cols = await this._getColumns(table);
    return buildTableInfo({ name: table, schema: null, columns: cols });
  }

  async safeQuery(query: string, maxRows: number): Promise<QueryResult> {
    const [rows, fields] = await this.pool.query(query) as [mysql.RowDataPacket[], mysql.FieldPacket[]];
    const limited = (rows as Record<string, unknown>[]).slice(0, maxRows);
    const columns = (fields ?? []).map(f => ({ name: f.name, type: String(f.type ?? 'unknown') }));
    return buildQueryResult(limited, columns, this.maxTextLength);
  }

  private async _getColumns(table: string): Promise<ColumnInfo[]> {
    const [cols] = await this.pool.query(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT,
              CHARACTER_MAXIMUM_LENGTH, COLUMN_KEY, COLUMN_COMMENT
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [this.database, table]
    );

    return (cols as mysql.RowDataPacket[]).map(r =>
      buildColumnInfo({
        name: String(r['COLUMN_NAME']),
        type: String(r['DATA_TYPE']),
        nullable: r['IS_NULLABLE'] === 'YES',
        isPrimaryKey: r['COLUMN_KEY'] === 'PRI',
        isForeignKey: r['COLUMN_KEY'] === 'MUL',
        isIndexed: ['PRI', 'UNI', 'MUL'].includes(String(r['COLUMN_KEY'] ?? '')),
        defaultValue: r['COLUMN_DEFAULT'] != null ? String(r['COLUMN_DEFAULT']) : null,
        maxLength:
          r['CHARACTER_MAXIMUM_LENGTH'] != null
            ? Number(r['CHARACTER_MAXIMUM_LENGTH'])
            : null,
        comment: r['COLUMN_COMMENT'] ? String(r['COLUMN_COMMENT']) : null,
      })
    );
  }
}
