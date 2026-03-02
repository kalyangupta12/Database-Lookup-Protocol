# Changelog

All notable changes to this project will be documented in this file.

## [1.1.5] - 2026-03-02

### Changed
- `dlp set` now accepts an optional IDE name argument, always creating the config dir:
  ```
  npx dlp set antigravity   # creates .gemini/antigravity/mcp_config.json
  npx dlp set cursor        # creates .cursor/mcp_config.json
  npx dlp set vscode        # creates .vscode/mcp_config.json
  npx dlp set claude        # creates .claude/mcp_config.json
  npx dlp set all           # creates all of the above
  npx dlp set               # updates ~/.mcp.json + any project configs that already exist
  ```

## [1.1.4] - 2026-03-02

### Changed
- `dlp set` now writes to all known IDE MCP config locations in one shot:
  - `~/.mcp.json` (Claude Code global — always created)
  - `.gemini/antigravity/mcp_config.json` (Gemini / antigravity — if dir exists)
  - `.claude/mcp_config.json` (Claude Code project-level — if dir exists)
  - `.cursor/mcp_config.json` (Cursor — if dir exists)
  - `.vscode/mcp_config.json` (VS Code — if dir exists)

  Output now lists every file that was updated.

## [1.1.3] - 2026-03-02

### Added
- `dlp set` command — run once per project to write `DATABASE_URL` from your local `.env` into `~/.mcp.json` automatically. No more manual config editing when switching projects.
  ```
  cd my-project
  npx dlp set
  # → [DLP] DATABASE_URL written to C:\Users\you\.mcp.json
  # → [DLP] Restart your IDE to apply the change.
  ```

## [1.1.2] - 2026-03-02

### Fixed
- `.env` is now discovered by walking up from cwd to the filesystem root, then falling back to `~/.env`.
  Previously DLP only checked the exact cwd, so MCP mode failed when the IDE spawned the server
  from a directory other than the project root. Now it reliably finds `DATABASE_URL` in any parent directory.
- `DLP_API_KEY` is pre-set to `"not-needed-for-mcp"` in the `.mcp.json` template and README config.
  IDE setup wizards scan the package source for `process.env` references and prompt for every var they find.
  Pre-setting this value suppresses the prompt — `DLP_API_KEY` is only enforced by the HTTP server, never MCP.

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
