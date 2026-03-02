import { BaseAdapter } from './base';
import { TableInfo, PreviewResult, QueryResult } from '../types/protocol';
import { buildColumnInfo, buildTableInfo } from '../core/schema';
import { buildPreview, buildQueryResult } from '../core/preview';

// PrismaClient is provided externally as a peer dependency.
// The adapter accepts any PrismaClient instance.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrismaClient = any;

export class PrismaAdapter extends BaseAdapter {
  constructor(private prisma: AnyPrismaClient, maxTextLength = 200) {
    super(maxTextLength);
  }

  async connect(): Promise<void> {
    await this.prisma.$connect();
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async getSchema(_schemaFilter?: string): Promise<TableInfo[]> {
    const dmmf =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.prisma._dmmf ?? this.prisma.constructor?._dmmf;
    if (!dmmf) {
      throw new Error('Prisma DMMF not available — ensure PrismaClient is generated');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return dmmf.datamodel.models.map((model: AnyPrismaClient) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const columns = model.fields.map((f: AnyPrismaClient) =>
        buildColumnInfo({
          name: f.name as string,
          type: f.type as string,
          nullable: !(f.isRequired as boolean),
          isPrimaryKey: f.isId as boolean,
          isForeignKey: f.relationName != null,
          isIndexed: (f.isUnique as boolean) || (f.isId as boolean),
          defaultValue: f.default != null ? String(f.default) : null,
        })
      );
      return buildTableInfo({ name: model.name as string, columns });
    });
  }

  async previewTable(table: string, limit: number): Promise<PreviewResult> {
    const modelName = this._resolveModelName(table);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const rows = await this.prisma[modelName].findMany({ take: limit });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const totalCount = await this.prisma[modelName].count();
    return buildPreview(
      table,
      rows as Record<string, unknown>[],
      totalCount as number,
      this.maxTextLength
    );
  }

  async describeTable(table: string): Promise<TableInfo> {
    const schema = await this.getSchema();
    const found = schema.find(t => t.name.toLowerCase() === table.toLowerCase());
    if (!found) throw new Error(`Model "${table}" not found in Prisma schema`);
    return found;
  }

  async safeQuery(query: string, _maxRows: number): Promise<QueryResult> {
    // $queryRawUnsafe is used because the query is already validated by validator.ts
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const rows: unknown[] = await this.prisma.$queryRawUnsafe(query);
    const typedRows = rows as Record<string, unknown>[];
    const columns =
      typedRows.length > 0
        ? Object.keys(typedRows[0]).map(k => ({ name: k, type: 'unknown' }))
        : [];
    return buildQueryResult(typedRows, columns, this.maxTextLength);
  }

  private _resolveModelName(table: string): string {
    const dmmf =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.prisma._dmmf ?? this.prisma.constructor?._dmmf;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const model = dmmf?.datamodel.models.find(
      (m: AnyPrismaClient) =>
        (m.name as string).toLowerCase() === table.toLowerCase()
    ) as AnyPrismaClient;
    if (!model) throw new Error(`Prisma model "${table}" not found`);
    const name = model.name as string;
    return name.charAt(0).toLowerCase() + name.slice(1);
  }
}
