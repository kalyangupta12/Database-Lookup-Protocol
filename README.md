# Database Lookup Protocol (DLP)

[![npm version](https://img.shields.io/npm/v/database-lookup-protocol.svg)](https://www.npmjs.com/package/database-lookup-protocol)
[![npm downloads](https://img.shields.io/npm/dm/database-lookup-protocol.svg)](https://www.npmjs.com/package/database-lookup-protocol)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/badge/website-dlp--mcp.vercel.app-blue)](https://dlp-mcp.vercel.app)

**DLP lets your AI coding assistant read your database — so it writes better code, faster.**

Ever had your AI assistant guess what your database looks like, only to generate wrong column names or miss relationships? DLP solves that. It gives tools like Claude Code, Cursor, VS Code Copilot, and antigravity (Gemini) **read-only access** to your database schema and data — no debug code needed, no copy-pasting table structures into chat.

> 🌐 **[dlp-mcp.vercel.app](https://dlp-mcp.vercel.app)** — Give Your AI Database Eyes

---

## What does DLP do?

Think of DLP as a bridge between your AI assistant and your database. Once set up:

- Your AI can **see your tables, columns, and relationships** automatically
- It can **preview actual data** to understand what's stored
- It can **run safe read-only queries** to answer questions about your data
- All of this happens **without you writing any code** or pasting schema dumps

**Example:** Instead of telling your AI "I have a users table with id, name, email columns...", it can just look at the database itself.

---

## How it works

DLP uses the **Model Context Protocol (MCP)** — an open standard that lets AI assistants use external tools. When you set up DLP:

1. Your IDE spawns DLP as a background process
2. DLP connects to your database using the `DATABASE_URL` from your project
3. Your AI assistant gets four new tools to inspect the database
4. Everything runs locally on your machine — your data never leaves

```
Your AI Assistant  <-->  DLP (MCP Server)  <-->  Your Database
   (Claude, etc.)         (runs locally)        (Postgres, MySQL, etc.)
```

---

## Installation

```bash
npm install database-lookup-protocol
```

Or use it directly without installing (via `npx`):

```bash
npx database-lookup-protocol set cursor
```

---

## Quick Start

Setting up DLP takes **two steps** and under a minute.

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher installed
- A database you want to connect to (PostgreSQL, MySQL, MongoDB, SQL Server, or Prisma)
- An IDE that supports MCP (Claude Code, Cursor, VS Code, or antigravity)

### Step 1: Add your database connection to `.env`

Make sure your project has a `.env` file with your database connection. If you already have one (most projects do), you're good — skip to Step 2.

**Option A: Single connection string** (most common)

```dotenv
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
```

**Option B: Individual variables** (if your project uses separate host/user/password vars)

```dotenv
# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=mydb
PG_USER=admin
PG_PASSWORD=secret

# MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=mydb
MYSQL_USER=admin
MYSQL_PASSWORD=secret

# MongoDB
MONGODB_URI=mongodb://localhost:27017/mydb

# SQL Server
MSSQL_HOST=localhost
MSSQL_PORT=1433
MSSQL_DATABASE=mydb
MSSQL_USER=admin
MSSQL_PASSWORD=secret
```

DLP automatically detects whichever format you use — `DATABASE_URL` or individual variables.

> **Not sure what your DATABASE_URL looks like?** See the [Connection String Formats](#connection-string-formats) section below for examples for each database.

### Step 2: Connect DLP to your IDE

Open a terminal **inside your project folder** (where your `.env` file is) and run:

```bash
# For antigravity (Gemini)
npx dlp set antigravity

# For Cursor
npx dlp set cursor

# For VS Code
npx dlp set vscode

# For Claude Code
npx dlp set claude

# For all IDEs at once
npx dlp set all
```

**That's it!** Restart your IDE and DLP is ready to use.

> **What just happened?** The `dlp set` command read your database connection variables from your project's `.env` file (either `DATABASE_URL` or individual vars like `PG_HOST`, `MYSQL_HOST`, etc.) and wrote the MCP configuration to your IDE's global config directory. Your AI assistant will now see DLP as an available tool.

---

## Using DLP in your AI assistant

Once set up, your AI assistant automatically has access to four database tools. You don't need to do anything special — just ask questions about your database naturally:

- *"What tables are in my database?"*
- *"Show me some sample data from the users table"*
- *"What columns does the orders table have?"*
- *"Find all users who signed up in the last week"*

Your AI will use DLP tools behind the scenes to answer these questions.

### Available tools

| Tool | What it does | Example use |
|------|-------------|-------------|
| `dlp_get_schema` | Shows all tables, columns, types, keys, and relationships | *"What does my database look like?"* |
| `dlp_describe_table` | Shows detailed info about one table — column types, indexes, defaults, constraints | *"Tell me about the orders table"* |
| `dlp_preview_table` | Shows sample rows from a table (up to 20 rows) | *"Show me some data from the users table"* |
| `dlp_safe_query` | Runs a read-only SQL SELECT query (must include LIMIT, max 20 rows) | *"How many orders were placed today?"* |

> **Tip:** You can tell your AI: "Use `dlp_get_schema` to understand the database before writing any queries" — this gives it the full picture upfront.

---

## Supported databases

DLP works with five popular databases. You only need to install the driver for the database you're using:

| Database | Install the driver | Status |
|----------|-------------------|--------|
| **PostgreSQL** | `npm install pg` | Production-ready |
| **MySQL / MariaDB** | `npm install mysql2` | Production-ready |
| **MongoDB** | `npm install mongodb` | Production-ready |
| **Microsoft SQL Server** | `npm install mssql` | Production-ready |
| **Prisma** (any DB Prisma supports) | `npm install @prisma/client` | Production-ready |

> **Note:** If your project already uses one of these drivers (check your `package.json`), you don't need to install anything extra.

### Connection string formats

Here's what `DATABASE_URL` looks like for each database:

```bash
# PostgreSQL
DATABASE_URL=postgresql://username:password@hostname:5432/database_name

# MySQL / MariaDB
DATABASE_URL=mysql://username:password@hostname:3306/database_name

# MongoDB
DATABASE_URL=mongodb://username:password@hostname:27017/database_name

# Microsoft SQL Server
DATABASE_URL=mssql://username:password@hostname:1433/database_name

# Prisma (uses whatever your Prisma schema defines)
DATABASE_URL=postgresql://username:password@hostname:5432/database_name
```

**Common hosted database examples:**

```bash
# Supabase (PostgreSQL)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# PlanetScale (MySQL)
DATABASE_URL=mysql://[user]:[password]@[host]/[database]?ssl={"rejectUnauthorized":true}

# MongoDB Atlas
DATABASE_URL=mongodb+srv://[user]:[password]@[cluster].mongodb.net/[database]

# Neon (PostgreSQL)
DATABASE_URL=postgresql://[user]:[password]@[host].neon.tech/[database]?sslmode=require

# Railway (PostgreSQL)
DATABASE_URL=postgresql://postgres:[password]@[host].railway.app:5432/railway
```

---

## Where does `dlp set` write configs?

When you run `npx dlp set <ide>`, it writes the MCP configuration to your IDE's global config directory in your home folder (`~` = `C:\Users\YourName` on Windows, `/Users/YourName` on Mac, `/home/YourName` on Linux):

| IDE | Config file location |
|-----|---------------------|
| antigravity (Gemini) | `~/.gemini/antigravity/mcp_config.json` |
| Cursor | `~/.cursor/mcp_config.json` |
| VS Code | `~/.vscode/mcp_config.json` |
| Claude Code | `~/.mcp.json` |

**Switching projects?** Just `cd` into the new project, and run `npx dlp set <ide>` again. It will update the config with the new project's database connection.

---

## Security

DLP is designed to be safe by default:

- **Read-only access** — DLP can only SELECT data. It cannot INSERT, UPDATE, DELETE, DROP, or modify your database in any way.
- **SQL injection protection** — 15+ dangerous SQL patterns are blocked before any query reaches your database.
- **No network exposure** — In MCP mode, DLP runs as a local process communicating via stdio. Your database credentials and data never leave your machine.
- **Row limits enforced** — All queries are capped at 20 rows. Long text fields are automatically truncated to 200 characters.
- **No API key needed** — MCP uses stdio (standard input/output), so there's no HTTP server or API key to worry about.

---

## Switching projects

When you switch to a different project with a different database:

1. Make sure the new project has a `.env` file with its database connection (`DATABASE_URL` or individual vars)
2. Open a terminal in that project folder
3. Run `npx dlp set <ide>` again
4. Restart your IDE

The config will be updated with the new database connection.

---

## HTTP Server Mode (Advanced)

> **Most users don't need this.** The MCP mode (set up above) is the recommended way to use DLP. HTTP mode is for custom integrations, scripts, or tools that can't use MCP.

If you want to run DLP as a standalone HTTP API:

```bash
# Add these to your .env
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
DLP_API_KEY=your-secret-key

# Start the server
npx dlp start
```

The server runs on `http://localhost:3434`. All requests go to `POST /protocol` with an `Authorization: Bearer <your-api-key>` header.

**Example requests:**

```bash
# Get database schema
curl -X POST http://localhost:3434/protocol \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_schema", "schema": "public"}'

# Preview table data
curl -X POST http://localhost:3434/protocol \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"action": "preview_table", "table": "users", "limit": 5}'

# Describe a table
curl -X POST http://localhost:3434/protocol \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"action": "describe_table", "table": "users"}'

# Run a read-only query
curl -X POST http://localhost:3434/protocol \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"action": "safe_query", "query": "SELECT id, email FROM users LIMIT 5"}'
```

**Rules:** Only SELECT queries are allowed. Every query must include a LIMIT clause. Maximum 20 rows returned.

---

## CLI Reference

```
npx dlp set <ide>         Read DB vars from .env and configure your IDE
npx dlp set all           Configure all supported IDEs at once
npx dlp start             Start HTTP API server on port 3434
npx dlp start --mcp       Start MCP stdio server
npx dlp mcp               Same as "start --mcp"
```

---

## Troubleshooting

**"DLP tools not showing up in my IDE"**
- Make sure you ran `npx dlp set <ide>` from inside your project folder (where `.env` is)
- Restart your IDE completely after running the set command
- Check that your `.env` file contains a valid `DATABASE_URL`

**"Cannot connect to database"**
- Verify your `DATABASE_URL` is correct by testing the connection with your database client
- Make sure the database server is running and accessible
- Check that you've installed the correct driver (`npm install pg` for PostgreSQL, etc.)

**"Permission denied" or "Config file error"**
- Run `npx dlp set <ide>` again — it will overwrite any broken config files
- Make sure you have write access to your home directory

**Switching to a different database?**
- Update `DATABASE_URL` in your project's `.env`
- Run `npx dlp set <ide>` again
- Restart your IDE

---

## Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/Database-Lookup-Protocol.git`
3. Create a feature branch: `git checkout -b feat/your-feature`
4. Make your changes in the `src/` directory
5. Build the project: `npm run build`
6. Test your changes locally
7. Open a Pull Request

### Adding a new database adapter

To add support for a new database:

1. Create a new adapter file in `src/adapters/` that implements the `DLPAdapter` interface
2. The adapter needs four methods: `getSchema()`, `previewTable()`, `describeTable()`, and `safeQuery()`
3. Register the adapter in `src/cli/index.ts`
4. Add the connection string format to this README

---

## Supported Environment Variables

`dlp set` automatically reads **all** database-related variables from your project's `.env` — not just `DATABASE_URL`. Here's the full list of variables it detects and writes into your IDE config:

| Variable | Database | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Any | Full connection string (auto-detects DB type from scheme) |
| `DB_TYPE` | Any | Explicitly set DB type: `postgres`, `mysql`, `mongodb`, `mssql`, `prisma` |
| **PostgreSQL** | | |
| `PG_HOST` / `PGHOST` | PostgreSQL | Database host |
| `PG_PORT` / `PGPORT` | PostgreSQL | Database port (default: 5432) |
| `PG_DATABASE` / `PGDATABASE` | PostgreSQL | Database name |
| `PG_USER` / `PGUSER` | PostgreSQL | Username |
| `PG_PASSWORD` / `PGPASSWORD` | PostgreSQL | Password |
| `PG_SSL` | PostgreSQL | Set to `true` to enable SSL |
| **MySQL / MariaDB** | | |
| `MYSQL_HOST` | MySQL | Database host |
| `MYSQL_PORT` | MySQL | Database port (default: 3306) |
| `MYSQL_DATABASE` | MySQL | Database name |
| `MYSQL_USER` | MySQL | Username |
| `MYSQL_PASSWORD` | MySQL | Password |
| **MongoDB** | | |
| `MONGODB_URI` | MongoDB | Full MongoDB connection URI |
| `MONGODB_DATABASE` | MongoDB | Database name (default: parsed from URI or `test`) |
| **SQL Server** | | |
| `MSSQL_HOST` | MSSQL | Database host |
| `MSSQL_PORT` | MSSQL | Database port (default: 1433) |
| `MSSQL_DATABASE` | MSSQL | Database name |
| `MSSQL_USER` | MSSQL | Username |
| `MSSQL_PASSWORD` | MSSQL | Password |
| `MSSQL_ENCRYPT` | MSSQL | Set to `false` to disable encryption |
| `MSSQL_TRUST_CERT` | MSSQL | Set to `true` to trust self-signed certificates |

**How it works:** When you run `npx dlp set <ide>`, it scans your `.env` for all of the above variables, and writes every one it finds into the IDE's MCP config `env` block. That way, when the IDE spawns the DLP MCP server, all your database credentials are available — regardless of whether you use a single `DATABASE_URL` or separate variables.

---

## License

MIT - see [LICENSE](LICENSE) for details.

---

**Built by [Kalyan Gupta](https://github.com/kalyangupta12) & [Arghajit Saha](https://github.com/ArghajitSaha)** | [🌐 Website](https://dlp-mcp.vercel.app) | [Report a bug](https://github.com/kalyangupta12/Database-Lookup-Protocol/issues) | [npm package](https://www.npmjs.com/package/database-lookup-protocol)
