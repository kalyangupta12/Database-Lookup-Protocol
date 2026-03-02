import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { DLPAdapter } from '../adapters/base';
import { DLPConfig } from '../types/protocol';
import { validateSafeQuery } from '../core/validator';
import { compactTableInfo } from '../core/formatter';

const DLP_TOOLS: Tool[] = [
  {
    name: 'dlp_get_schema',
    description:
      'Returns all tables/collections in the connected database with column names, types, ' +
      'primary keys, foreign keys, and row counts. Call this first to understand the database ' +
      'structure before writing any queries or debug code. ' +
      'Use the schema parameter to filter to a specific schema (e.g. "public") and avoid noise from system schemas.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        schema: {
          type: 'string',
          description:
            'Filter to a single database schema (e.g. "public" for PostgreSQL, "dbo" for MSSQL). ' +
            'Omit to return all schemas.',
        },
      },
      required: [],
    },
  },
  {
    name: 'dlp_preview_table',
    description:
      'Returns sample rows from a database table or collection. Default 5 rows, max 20. ' +
      'Long text fields are automatically truncated to 200 characters. Also returns total row count.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        table: { type: 'string', description: 'Table or collection name' },
        limit: {
          type: 'number',
          description: 'Number of rows to return (1-20, default 5)',
        },
        schema: {
          type: 'string',
          description: 'Database schema name (PostgreSQL / MSSQL only, default: public)',
        },
      },
      required: ['table'],
    },
  },
  {
    name: 'dlp_describe_table',
    description:
      'Returns detailed column information for a single table or collection: data types, ' +
      'nullability, primary keys, foreign keys, indexes, default values, and comments.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        table: { type: 'string', description: 'Table or collection name' },
        schema: {
          type: 'string',
          description: 'Database schema name (PostgreSQL / MSSQL only)',
        },
      },
      required: ['table'],
    },
  },
  {
    name: 'dlp_safe_query',
    description:
      'Executes a read-only SELECT query and returns results. ' +
      'Rules: must be SELECT only, no INSERT/UPDATE/DELETE/DROP/TRUNCATE allowed, ' +
      'must include a LIMIT clause (max 20 rows enforced server-side). ' +
      'For MongoDB: use JSON filter format with /* collection: name */ comment prefix, ' +
      'e.g. /* collection: users */ {"status": "active"}',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description:
            'SQL SELECT query with required LIMIT, e.g. "SELECT id, name FROM users LIMIT 5"',
        },
      },
      required: ['query'],
    },
  },
];

export async function startMCPServer(adapter: DLPAdapter, config: DLPConfig): Promise<void> {
  const server = new Server(
    { name: 'database-lookup-protocol', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: DLP_TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        case 'dlp_get_schema': {
          const schemaFilter = args['schema'] ? String(args['schema']) : undefined;
          const tables = await adapter.getSchema(schemaFilter);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ tables: compactTableInfo(tables) }, null, 2),
              },
            ],
          };
        }

        case 'dlp_preview_table': {
          const table = String(args['table'] ?? '');
          const limit = Math.min(
            Number(args['limit'] ?? config.defaultPreviewRows),
            config.maxRows
          );
          const schema = args['schema'] ? String(args['schema']) : undefined;
          const result = await adapter.previewTable(table, limit, schema);
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        }

        case 'dlp_describe_table': {
          const table = String(args['table'] ?? '');
          const schema = args['schema'] ? String(args['schema']) : undefined;
          const result = await adapter.describeTable(table, schema);
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        }

        case 'dlp_safe_query': {
          const query = String(args['query'] ?? '');
          const validation = validateSafeQuery(query);
          if (!validation.valid) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(validation.error) }],
              isError: true,
            };
          }
          const result = await adapter.safeQuery(query, config.maxRows);
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        }

        default:
          return {
            content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Use stderr so stdout stays clean for MCP JSON-RPC protocol
  process.stderr.write('[DLP] MCP server running on stdio\n');
}
