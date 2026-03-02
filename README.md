# Database Lookup Protocol (DLP)

[![npm version](https://img.shields.io/npm/v/database-lookup-protocol.svg)](https://www.npmjs.com/package/database-lookup-protocol)
[![npm downloads](https://img.shields.io/npm/dm/database-lookup-protocol.svg)](https://www.npmjs.com/package/database-lookup-protocol)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**DLP lets your AI coding assistant read your database — so it writes better code, faster.**

Ever had your AI assistant guess what your database looks like, only to generate wrong column names or miss relationships? DLP solves that. It gives tools like Claude Code, Cursor, VS Code Copilot, and antigravity (Gemini) **read-only access** to your database schema and data — no debug code needed, no copy-pasting table structures into chat.

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

## Quick Start

Setting up DLP takes **two steps** and under a minute.

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher installed
- A database you want to connect to (PostgreSQL, MySQL, MongoDB, SQL Server, or Prisma)
- An IDE that supports MCP (Claude Code, Cursor, VS Code, or antigravity)

### Step 1: Add your database connection string

Make sure your project has a `.env` file with your `DATABASE_URL`. If you already have one (most projects do), you're good — skip to Step 2.

If you don't have one yet, create a `.env` file in your project root:

```dotenv
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
```

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

> **What just happened?** The `dlp set` command read `DATABASE_URL` from your project's `.env` file and wrote the MCP configuration to your IDE's global config directory. Your AI assistant will now see DLP as an available tool.

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

**Switching projects?** Just `cd` into the new project, and run `npx dlp set <ide>` again. It will update the config with the new project's `DATABASE_URL`.

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

1. Make sure the new project has a `.env` file with its `DATABASE_URL`
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
npx dlp set <ide>         Read DATABASE_URL from .env and configure your IDE
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

## License

MIT - see [LICENSE](LICENSE) for details.

---

**Built by [Kalyan Gupta](https://github.com/kalyangupta12)** | [Report a bug](https://github.com/kalyangupta12/Database-Lookup-Protocol/issues) | [npm package](https://www.npmjs.com/package/database-lookup-protocol)
