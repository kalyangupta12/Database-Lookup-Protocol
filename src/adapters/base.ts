import { TableInfo, PreviewResult, QueryResult } from '../types/protocol';

export interface DLPAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getSchema(schemaFilter?: string): Promise<TableInfo[]>;
  previewTable(table: string, limit: number, schema?: string): Promise<PreviewResult>;
  describeTable(table: string, schema?: string): Promise<TableInfo>;
  safeQuery(query: string, maxRows: number): Promise<QueryResult>;
}

export abstract class BaseAdapter implements DLPAdapter {
  constructor(protected maxTextLength: number) {}

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getSchema(schemaFilter?: string): Promise<TableInfo[]>;
  abstract previewTable(table: string, limit: number, schema?: string): Promise<PreviewResult>;
  abstract describeTable(table: string, schema?: string): Promise<TableInfo>;
  abstract safeQuery(query: string, maxRows: number): Promise<QueryResult>;
}
