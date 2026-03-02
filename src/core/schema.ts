import { ColumnInfo, TableInfo } from '../types/protocol';

const TYPE_MAP: Record<string, string> = {
  // PostgreSQL
  int2: 'int2', int4: 'int4', int8: 'int8',
  float4: 'float4', float8: 'float8',
  numeric: 'decimal', money: 'decimal',
  bool: 'boolean', boolean: 'boolean',
  text: 'text', varchar: 'varchar', bpchar: 'char',
  uuid: 'uuid',
  timestamp: 'timestamp', timestamptz: 'timestamptz',
  date: 'date', time: 'time', timetz: 'timetz',
  json: 'json', jsonb: 'jsonb',
  bytea: 'binary',
  // MySQL / MSSQL
  tinyint: 'int1', smallint: 'int2', mediumint: 'int3',
  int: 'int4', integer: 'int4', bigint: 'int8',
  decimal: 'decimal', double: 'float8', float: 'float4',
  bit: 'boolean',
  char: 'char', tinytext: 'text', mediumtext: 'text', longtext: 'text',
  tinyblob: 'binary', blob: 'binary', mediumblob: 'binary', longblob: 'binary',
  datetime: 'timestamp', datetime2: 'timestamp',
  nvarchar: 'varchar', nchar: 'char', ntext: 'text',
  uniqueidentifier: 'uuid',
  // MongoDB
  objectid: 'objectid', bindata: 'binary', object: 'object', array: 'array',
};

export function normalizeType(rawType: string): string {
  const lower = rawType.toLowerCase().replace(/\s*\(.*\)/, '');
  return TYPE_MAP[lower] ?? rawType.toLowerCase();
}

export function buildColumnInfo(
  partial: Partial<ColumnInfo> & { name: string; type: string }
): ColumnInfo {
  return {
    name: partial.name,
    type: normalizeType(partial.type),
    nullable: partial.nullable ?? true,
    isPrimaryKey: partial.isPrimaryKey ?? false,
    isForeignKey: partial.isForeignKey ?? false,
    isIndexed: partial.isIndexed ?? false,
    defaultValue: partial.defaultValue ?? null,
    maxLength: partial.maxLength ?? null,
    comment: partial.comment ?? null,
  };
}

export function buildTableInfo(
  partial: Partial<TableInfo> & { name: string; columns: ColumnInfo[] }
): TableInfo {
  return {
    name: partial.name,
    schema: partial.schema ?? null,
    type: partial.type ?? 'table',
    rowCount: partial.rowCount ?? null,
    columns: partial.columns,
  };
}
