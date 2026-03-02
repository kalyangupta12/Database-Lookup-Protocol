# Changelog

All notable changes to this project will be documented in this file.

## [1.1.1] - 2026-03-02

### Changed
- README Quick Start split into MCP path and HTTP path — MCP users no longer see `DLP_API_KEY` as a required step
- `DLP_API_KEY` commented out in `.env.example` with note that it is HTTP-only
- MCP Integration section simplified — no duplicate setup instructions

## [1.1.0] - 2026-03-02

### Added
- `schema` filter parameter on `get_schema` action — agents can now call `{"action":"get_schema","schema":"public"}` to get only their app tables instead of all system schemas
- `dlp_get_schema` MCP tool now accepts optional `schema` argument
- `DLP_API_KEY` is no longer required in MCP mode — MCP uses stdio process isolation, so no HTTP auth is needed. Just set `DATABASE_URL` and go.

### Changed
- All `console.log` in MCP startup path changed to `process.stderr.write` to keep stdout clean for MCP JSON-RPC
- `.mcp.json` template simplified — only `DATABASE_URL` required for MCP users

### Fixed
- Agents no longer need to write parser scripts to filter system schemas from `get_schema` responses

## [1.0.0] - 2026-03-02

### Added
- Initial release
- HTTP REST server on port 3434 with 4 protocol actions: `get_schema`, `preview_table`, `describe_table`, `safe_query`
- MCP stdio server with 4 tool definitions for Claude Code, Cursor, Copilot
- Database adapters: PostgreSQL, MySQL/MariaDB, MongoDB, MSSQL, Prisma
- Auto-detection of database type from `DATABASE_URL` or env vars
- SQL injection validator with 15+ blocked patterns
- Token-optimized responses — truncation, compact schema format, fast row count estimates
- API key authentication for HTTP server
- CLI: `npx dlp start`, `npx dlp mcp`
