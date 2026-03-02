# Database Lookup Protocol (DLP)

[![npm version](https://img.shields.io/npm/v/database-lookup-protocol.svg)](https://www.npmjs.com/package/database-lookup-protocol)
[![npm downloads](https://img.shields.io/npm/dm/database-lookup-protocol.svg)](https://www.npmjs.com/package/database-lookup-protocol)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Agents should inspect — not guess.

DLP gives IDE agents (Claude Code, Cursor, Copilot, antigravity) a **read-only window** into your database — no debug code, no wasted tokens.

---

## Setup (2 steps)

### 1. Add `DATABASE_URL` to your project `.env`

```dotenv
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
```

### 2. Run `dlp set` for your IDE

```bash
npx dlp set antigravity    # Gemini / antigravity
npx dlp set cursor          # Cursor
npx dlp set vscode          # VS Code
npx dlp set claude          # Claude Code
npx dlp set all             # all of the above
```

Done. Restart your IDE — DLP is ready.

Switch projects? Update `.env`, run `npx dlp set <ide>` again.

---

## What `dlp set` does

1. Reads `DATABASE_URL` from your project's `.env`
2. Writes the MCP config to your IDE's global config directory:

| IDE | Config written to |
|-----|-------------------|
| antigravity | `~/.gemini/antigravity/mcp_config.json` |
| Cursor | `~/.cursor/mcp_config.json` |
| VS Code | `~/.vscode/mcp_config.json` |
| Claude Code | `~/.mcp.json` |

No API key needed — MCP runs over stdio (process-isolated, no network exposure).

---

## Available tools (for your agent)

Once set up, tell your agent:

> "Use dlp_get_schema to understand the database."

| Tool | Description |
|------|-------------|
| `dlp_get_schema` | Full database schema. Pass `schema: "public"` to filter. |
| `dlp_preview_table` | Sample rows from any table (default 5, max 20). |
| `dlp_describe_table` | Column types, keys, indexes, defaults for one table. |
| `dlp_safe_query` | Run a read-only SELECT (must include LIMIT, max 20 rows). |

---

## Supported databases

| Database | Driver | Install |
|----------|--------|---------|
| PostgreSQL | `pg` | `npm i pg` |
| MySQL / MariaDB | `mysql2` | `npm i mysql2` |
| MongoDB | `mongodb` | `npm i mongodb` |
| SQL Server | `mssql` | `npm i mssql` |
| Prisma | `@prisma/client` | `npm i @prisma/client` |

### DATABASE_URL formats

```
postgresql://user:pass@host:5432/db
mysql://user:pass@host:3306/db
mongodb://user:pass@host:27017/db
mssql://user:pass@host:1433/db
```

---

## HTTP server mode (optional)

For non-MCP usage (REST API on port 3434):

```bash
# .env
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
DLP_API_KEY=your-secret-key

npx dlp start
```

### Endpoints

All requests: `POST /protocol` with `Authorization: Bearer <key>`.

```json
{"action": "get_schema", "schema": "public"}
{"action": "preview_table", "table": "users", "limit": 5}
{"action": "describe_table", "table": "users"}
{"action": "safe_query", "query": "SELECT id, email FROM users LIMIT 5"}
```

**Rules:** SELECT only. LIMIT required. No INSERT/UPDATE/DELETE/DROP.

---

## CLI reference

```
dlp set <ide>           Write DATABASE_URL from .env to IDE config
dlp set all             Write to all IDE configs
dlp start               HTTP server (port 3434)
dlp start --mcp         MCP stdio server
dlp mcp                 Alias for start --mcp
```

---

## Security

- Read-only — no write operations allowed
- 15+ SQL injection patterns blocked
- API key auth on HTTP endpoints (not needed for MCP)
- Localhost-only binding option
- Row and text length limits enforced

---

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make changes in `src/`
4. Build: `npm run build`
5. Open a PR

To add a database adapter, implement `DLPAdapter` in `src/adapters/` and wire it into `src/cli/index.ts`.

---

## License

MIT
