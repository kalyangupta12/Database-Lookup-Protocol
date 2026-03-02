import { MongoClient, Db } from 'mongodb';
import { BaseAdapter } from './base';
import { TableInfo, PreviewResult, QueryResult, ColumnInfo } from '../types/protocol';
import { buildColumnInfo, buildTableInfo, normalizeType } from '../core/schema';
import { buildPreview } from '../core/preview';

export interface MongoDBConfig {
  uri: string;
  database: string;
  maxTextLength?: number;
}

export class MongoDBAdapter extends BaseAdapter {
  private client: MongoClient;
  private db!: Db;
  private database: string;

  constructor(config: MongoDBConfig) {
    super(config.maxTextLength ?? 200);
    this.client = new MongoClient(config.uri);
    this.database = config.database;
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db(this.database);
    await this.db.command({ ping: 1 });
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  async getSchema(_schemaFilter?: string): Promise<TableInfo[]> {
    const collections = await this.db.listCollections().toArray();
    const tables: TableInfo[] = [];

    for (const col of collections) {
      const sample = await this.db.collection(col.name).find({}).limit(100).toArray();
      const cols = this._inferColumns(sample as Record<string, unknown>[]);
      const count = await this.db.collection(col.name).estimatedDocumentCount();
      tables.push(
        buildTableInfo({
          name: col.name,
          schema: null,
          type: 'collection',
          rowCount: count,
          columns: cols,
        })
      );
    }
    return tables;
  }

  async previewTable(table: string, limit: number): Promise<PreviewResult> {
    const rows = await this.db.collection(table).find({}).limit(limit).toArray();
    const totalCount = await this.db.collection(table).estimatedDocumentCount();
    const serialized = rows.map(r => {
      const { _id, ...rest } = r as Record<string, unknown> & { _id: unknown };
      return { _id: String(_id), ...rest } as Record<string, unknown>;
    });
    return buildPreview(table, serialized, totalCount, this.maxTextLength);
  }

  async describeTable(table: string): Promise<TableInfo> {
    const sample = await this.db.collection(table).find({}).limit(100).toArray();
    const cols = this._inferColumns(sample as Record<string, unknown>[]);
    const count = await this.db.collection(table).estimatedDocumentCount();
    return buildTableInfo({
      name: table,
      schema: null,
      type: 'collection',
      rowCount: count,
      columns: cols,
    });
  }

  // MongoDB safe_query: expects a JSON filter with /* collection: name */ prefix
  // Example: /* collection: users */ {"status": "active"}
  async safeQuery(query: string, maxRows: number): Promise<QueryResult> {
    const colMatch = query.match(/\/\*\s*collection:\s*(\w+)\s*\*\//);
    if (!colMatch) {
      throw new Error(
        'MongoDB safe_query: include collection name as /* collection: myCol */ before the filter JSON'
      );
    }
    const colName = colMatch[1];
    const jsonPart = query.replace(/\/\*.*?\*\//, '').trim();

    let filter: Record<string, unknown> = {};
    if (jsonPart) {
      try {
        filter = JSON.parse(jsonPart) as Record<string, unknown>;
      } catch {
        throw new Error('MongoDB safe_query: filter must be valid JSON, e.g. {"status":"active"}');
      }
    }

    const rows = await this.db.collection(colName).find(filter).limit(maxRows).toArray();
    const serialized = rows.map(r => {
      const { _id, ...rest } = r as Record<string, unknown> & { _id: unknown };
      return { _id: String(_id), ...rest } as Record<string, unknown>;
    });

    const columns =
      serialized.length > 0
        ? Object.keys(serialized[0]).map(k => ({ name: k, type: 'mixed' }))
        : [];

    return {
      rows: serialized,
      rowCount: serialized.length,
      truncatedFields: [],
      columns,
    };
  }

  private _inferColumns(docs: Record<string, unknown>[]): ColumnInfo[] {
    const fieldTypes = new Map<string, Set<string>>();

    for (const doc of docs) {
      for (const [key, val] of Object.entries(doc)) {
        if (!fieldTypes.has(key)) fieldTypes.set(key, new Set());
        fieldTypes.get(key)!.add(this._mongoType(val));
      }
    }

    return Array.from(fieldTypes.entries()).map(([name, types]) => {
      const typeStr = types.size === 1 ? (types.values().next().value as string) : 'mixed';
      return buildColumnInfo({ name, type: typeStr, nullable: true });
    });
  }

  private _mongoType(val: unknown): string {
    if (val === null || val === undefined) return 'null';
    if (Array.isArray(val)) return 'array';
    const t = typeof val;
    if (t === 'object') {
      if (val instanceof Date) return 'date';
      const bsonType = (val as Record<string, unknown>)['_bsontype'];
      if (bsonType === 'ObjectID' || bsonType === 'ObjectId') return 'objectid';
      return 'object';
    }
    return normalizeType(t);
  }
}
