# Database Lookup Protocol (DLP)

[![npm version](https://img.shields.io/npm/v/database-lookup-protocol.svg)](https://www.npmjs.com/package/database-lookup-protocol)
[![npm downloads](https://img.shields.io/npm/dm/database-lookup-protocol.svg)](https://www.npmjs.com/package/database-lookup-protocol)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

> Agents should inspect — not guess.

DLP is a lightweight, agent-friendly protocol that lets IDE agents (Claude Code, Cursor, Copilot, Codex) inspect database schemas and preview data safely — without writing debug code or wasting tokens.

## Why DLP?

Without DLP, agents debug databases by writing temporary code, generating console logs, running raw queries, and burning tokens. DLP gives agents a **direct, structured, read-only window** into your database.

```
IDE Agent (Claude Code / Cursor / Copilot)
            ↓
       DLP Client / MCP Tool
            ↓
       DLP Server
            ↓
    Database (Postgres / MySQL / MongoDB / MSSQL)
```

---

## Quick Start (30 seconds)

```bash
npm install -g database-lookup-protocol

# Copy and fill in your database credentials
cp .env.example .env

# Start the server
npx dlp start
```

---

## Installation

```bash
npm install database-lookup-protocol

# Install the DB driver you need (only install what you use)
npm install pg           # PostgreSQL
npm install mysql2       # MySQL / MariaDB
npm install mongodb      # MongoDB
npm install mssql        # SQL Server
npm install @prisma/client  # Prisma
```

---

## Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```dotenv
# Auto-detect from URL:
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb

# Or set explicitly:
DB_TYPE=postgres

# Security
DLP_API_KEY=your-secret-key

# Server
PORT=3434
LOCALHOST_ONLY=true

# Limits
MAX_ROWS=20
DEFAULT_PREVIEW_ROWS=5
MAX_TEXT_LENGTH=200
```

### Supported DATABASE_URL formats

| Database | Example URL |
|----------|-------------|
| PostgreSQL | `postgresql://user:pass@host:5432/db` |
| MySQL | `mysql://user:pass@host:3306/db` |
| MongoDB | `mongodb://user:pass@host:27017/db` |
| SQL Server | `mssql://user:pass@host:1433/db` |

---

## CLI Commands

```bash
dlp start              # HTTP server on port 3434 (default)
dlp start --mcp        # MCP stdio server for IDE integration
dlp start --http-only  # HTTP server only
dlp mcp                # Alias for start --mcp
```

---

## HTTP API

All requests are `POST /protocol` with `Content-Type: application/json`.

Authentication via `Authorization: Bearer <key>`, `X-API-Key: <key>`, or `?apiKey=<key>`.

### 1. Get Schema

```bash
# All schemas
curl -X POST http://localhost:3434/protocol \
  -H "Authorization: Bearer your-key" \
  -H "Content-Type: application/json" \
  -d '{"action":"get_schema"}'

# Filter to a single schema (recommended — avoids system schema noise)
curl -X POST http://localhost:3434/protocol \
  -H "Authorization: Bearer your-key" \
  -H "Content-Type: application/json" \
  -d '{"action":"get_schema","schema":"public"}'
```

Response:
```json
{
  "tables": [
    {
      "name": "users",
      "type": "table",
      "rowCount": 1240,
      "columns": [
        { "name": "id", "type": "uuid", "pk": true },
        { "name": "email", "type": "varchar", "maxLength": 255 },
        { "name": "created_at", "type": "timestamptz", "nullable": true }
      ]
    }
  ]
}
```

### 2. Preview Table

```json
{ "action": "preview_table", "table": "users", "limit": 5 }
```

Response:
```json
{
  "table": "users",
  "rows": [{ "id": "abc-123", "email": "alice@example.com", "created_at": "2024-01-01T00:00:00Z" }],
  "totalCount": 1240,
  "returnedCount": 5,
  "truncatedFields": []
}
```

### 3. Describe Table

```json
{ "action": "describe_table", "table": "users" }
```

### 4. Safe Query

```json
{ "action": "safe_query", "query": "SELECT id, email FROM users LIMIT 3" }
```

**Rules:** SELECT only · must include LIMIT · no INSERT/UPDATE/DELETE/DROP/UNION

**MongoDB:** Use JSON filter with collection comment:
```json
{ "action": "safe_query", "query": "/* collection: users */ {\"status\": \"active\"}" }
```

---

## MCP Integration (Claude Code / Cursor)

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "dlp": {
      "command": "npx",
      "args": ["database-lookup-protocol", "mcp"],
      "env": {
        "DATABASE_URL": "postgresql://...",
        "DLP_API_KEY": "your-secret"
      }
    }
  }
}
```

Then in Claude Code, you can say:

> "Use dlp_get_schema to understand the database before writing the migration."

Available MCP tools:
- `dlp_get_schema` — Get full database schema
- `dlp_preview_table` — Sample rows from any table
- `dlp_describe_table` — Detailed column metadata
- `dlp_safe_query` — Run a validated SELECT query

---

## Using as a Library

```typescript
import { PostgresAdapter, startHttpServer, startMCPServer } from 'database-lookup-protocol';

const adapter = new PostgresAdapter({
  connectionString: process.env.DATABASE_URL!,
});

await adapter.connect();

// Use HTTP server
await startHttpServer(adapter, {
  dbType: 'postgres',
  port: 3434,
  localhostOnly: true,
  apiKey: 'my-key',
  maxRows: 20,
  defaultPreviewRows: 5,
  maxTextLength: 200,
});
```

---

## Security

- **Read-only by default** — no write operations allowed
- **Query validation** — 15+ injection patterns blocked by regex
- **API key authentication** on all protocol endpoints
- **Localhost-only binding** option (`LOCALHOST_ONLY=true`)
- **Identifier sanitization** — table/schema names validated before interpolation
- **Row and text limits** — no unbounded data dumps

---

## Supported Databases

| Database | Driver | Status |
|----------|--------|--------|
| PostgreSQL | `pg` | Full support |
| MySQL / MariaDB | `mysql2` | Full support |
| MongoDB | `mongodb` | Schema inference |
| SQL Server | `mssql` | Full support |
| Prisma | `@prisma/client` | DMMF schema + raw query |

---

## Roadmap

- SQLite adapter
- GraphQL introspection support
- Multi-DB federation
- OpenAPI / JSON Schema export
- Query cost estimation
- Hosted DLP Cloud

---

## Contributing

Contributions are welcome. Please open an issue before submitting a PR for major changes.

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make changes in `src/`
4. Build: `npm run build`
5. Open a PR

To add a new database adapter, implement the `DLPAdapter` interface in `src/adapters/` and wire it into `src/cli/index.ts`.

---

## License

MIT
