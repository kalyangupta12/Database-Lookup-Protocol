import Database from 'better-sqlite3';
import { BaseAdapter } from './base';
import { TableInfo, PreviewResult, QueryResult, ColumnInfo } from '../types/protocol';
import { buildColumnInfo, buildTableInfo } from '../core/schema';
import { buildPreview, buildQueryResult } from '../core/preview';
import { sanitizeIdentifier } from '../core/validator';

export interface SQLiteConfig {
  databasePath: string;
  maxTextLength?: number;
}

export class SQLiteAdapter extends BaseAdapter {
  private db!: Database.Database;
  private databasePath: string;

  constructor(config: SQLiteConfig) {
    super(config.maxTextLength ?? 200);
    this.databasePath = config.databasePath;
  }

  async connect(): Promise<void> {
    this.db = new Database(this.databasePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  async disconnect(): Promise<void> {
    this.db.close();
  }

  async getSchema(_schemaFilter?: string): Promise<TableInfo[]> {
    const rows = this.db.prepare(
      `SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name`
    ).all() as { name: string; type: string }[];

    const tables: TableInfo[] = [];
    for (const meta of rows) {
      const cols = this._getColumns(meta.name);
      const count = this._getCount(meta.name);
      tables.push(
        buildTableInfo({
          name: meta.name,
          schema: null,
          type: meta.type === 'view' ? 'view' : 'table',
          rowCount: count,
          columns: cols,
        })
      );
    }
    return tables;
  }

  async previewTable(table: string, limit: number, _schema?: string): Promise<PreviewResult> {
    const safe = sanitizeIdentifier(table);
    const rows = this.db.prepare(`SELECT * FROM "${safe}" LIMIT ?`).all(limit);
    const totalCount = this._getCount(safe);
    return buildPreview(table, rows as Record<string, unknown>[], totalCount, this.maxTextLength);
  }

  async describeTable(table: string, _schema?: string): Promise<TableInfo> {
    const safe = sanitizeIdentifier(table);
    const cols = this._getColumns(safe);
    const count = this._getCount(safe);
    return buildTableInfo({ name: table, schema: null, rowCount: count, columns: cols });
  }

  async safeQuery(query: string, maxRows: number): Promise<QueryResult> {
    const stmt = this.db.prepare(query);
    const allRows = stmt.all() as Record<string, unknown>[];
    const limited = allRows.slice(0, maxRows);
    const columns =
      limited.length > 0
        ? Object.keys(limited[0]).map(k => ({ name: k, type: 'unknown' }))
        : [];
    return buildQueryResult(limited, columns, this.maxTextLength);
  }

  private _getColumns(table: string): ColumnInfo[] {
    const colInfo = this.db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    const fkInfo = this.db.prepare(`PRAGMA foreign_key_list("${table}")`).all() as Array<{
      from: string;
    }>;
    const fkCols = new Set(fkInfo.map(f => f.from));

    const indexList = this.db.prepare(`PRAGMA index_list("${table}")`).all() as Array<{
      name: string;
    }>;

    const indexedCols = new Set<string>();
    for (const idx of indexList) {
      const idxInfo = this.db.prepare(`PRAGMA index_info("${idx.name}")`).all() as Array<{
        name: string;
      }>;
      for (const info of idxInfo) {
        indexedCols.add(info.name);
      }
    }

    return colInfo.map(c =>
      buildColumnInfo({
        name: c.name,
        type: c.type || 'text',
        nullable: c.notnull === 0,
        isPrimaryKey: c.pk > 0,
        isForeignKey: fkCols.has(c.name),
        isIndexed: indexedCols.has(c.name),
        defaultValue: c.dflt_value,
        maxLength: null,
        comment: null,
      })
    );
  }

  private _getCount(table: string): number | null {
    const row = this.db.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get() as { count: number } | undefined;
    return row?.count ?? null;
  }
}
