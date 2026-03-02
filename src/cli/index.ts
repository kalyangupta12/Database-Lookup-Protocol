import * as fs from 'fs';
import * as path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { DBType, DLPConfig } from '../types/protocol';
import { DLPAdapter } from '../adapters/base';
import { startHttpServer } from '../server/index';
import { startMCPServer } from '../mcp/server';

// ── .env Discovery ────────────────────────────────────────────────────────────
// Walk up from cwd looking for the nearest .env, then fall back to ~/.env.
// This lets a project .env be found regardless of what cwd the IDE uses when
// spawning the MCP server (some IDEs use the IDE install dir, not the project).
function loadEnv(): void {
  const tried = new Set<string>();

  // Walk up from cwd
  let dir = process.cwd();
  while (true) {
    const candidate = path.join(dir, '.env');
    if (!tried.has(candidate) && fs.existsSync(candidate)) {
      dotenvConfig({ path: candidate });
      return;
    }
    tried.add(candidate);
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  // Fallback: home directory ~/.env
  const home = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '';
  if (home) {
    const homeEnv = path.join(home, '.env');
    if (!tried.has(homeEnv) && fs.existsSync(homeEnv)) {
      dotenvConfig({ path: homeEnv });
    }
  }
}

loadEnv();

// ── DB Type Detection ────────────────────────────────────────────────────────
function detectDBType(): DBType {
  if (process.env['DB_TYPE']) {
    const t = process.env['DB_TYPE'].toLowerCase() as DBType;
    const valid: DBType[] = ['postgres', 'mysql', 'mongodb', 'mssql', 'prisma'];
    if (valid.includes(t)) return t;
    throw new Error(
      `Invalid DB_TYPE: "${process.env['DB_TYPE']}". Valid values: ${valid.join(', ')}`
    );
  }

  const url = process.env['DATABASE_URL'] ?? '';
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) return 'postgres';
  if (url.startsWith('mysql://') || url.startsWith('mariadb://')) return 'mysql';
  if (url.startsWith('mongodb://') || url.startsWith('mongodb+srv://')) return 'mongodb';
  if (url.startsWith('mssql://') || url.startsWith('sqlserver://')) return 'mssql';

  if (process.env['PG_HOST'] ?? process.env['PGHOST']) return 'postgres';
  if (process.env['MYSQL_HOST']) return 'mysql';
  if (process.env['MONGODB_URI']) return 'mongodb';
  if (process.env['MSSQL_HOST']) return 'mssql';

  throw new Error(
    'Cannot detect database type. Set DATABASE_URL, DB_TYPE, or a driver-specific env var ' +
      '(PG_HOST, MYSQL_HOST, MONGODB_URI, MSSQL_HOST).'
  );
}

// ── Adapter Factory ──────────────────────────────────────────────────────────
async function createAdapter(dbType: DBType, config: DLPConfig): Promise<DLPAdapter> {
  const maxTextLength = config.maxTextLength;

  switch (dbType) {
    case 'postgres': {
      const { PostgresAdapter } = await import('../adapters/postgres');
      const url = process.env['DATABASE_URL'];
      if (url) {
        return new PostgresAdapter({ connectionString: url, maxTextLength });
      }
      return new PostgresAdapter({
        host: process.env['PG_HOST'] ?? process.env['PGHOST'] ?? 'localhost',
        port: Number(process.env['PG_PORT'] ?? process.env['PGPORT'] ?? 5432),
        database: process.env['PG_DATABASE'] ?? process.env['PGDATABASE'] ?? '',
        user: process.env['PG_USER'] ?? process.env['PGUSER'] ?? '',
        password: process.env['PG_PASSWORD'] ?? process.env['PGPASSWORD'] ?? '',
        ssl:
          process.env['PG_SSL'] === 'true'
            ? ({ rejectUnauthorized: false } as Record<string, unknown>)
            : undefined,
        maxTextLength,
      });
    }

    case 'mysql': {
      const { MySQLAdapter } = await import('../adapters/mysql');
      const url = process.env['DATABASE_URL'];
      if (url) {
        const u = new URL(url);
        return new MySQLAdapter({
          host: u.hostname,
          port: Number(u.port || 3306),
          database: u.pathname.slice(1),
          user: u.username,
          password: u.password,
          maxTextLength,
        });
      }
      return new MySQLAdapter({
        host: process.env['MYSQL_HOST'] ?? 'localhost',
        port: Number(process.env['MYSQL_PORT'] ?? 3306),
        database: process.env['MYSQL_DATABASE'] ?? '',
        user: process.env['MYSQL_USER'] ?? '',
        password: process.env['MYSQL_PASSWORD'] ?? '',
        maxTextLength,
      });
    }

    case 'mongodb': {
      const { MongoDBAdapter } = await import('../adapters/mongodb');
      const uri =
        process.env['MONGODB_URI'] ??
        process.env['DATABASE_URL'] ??
        'mongodb://localhost:27017';
      const database =
        process.env['MONGODB_DATABASE'] ??
        (() => {
          try {
            return new URL(uri).pathname.slice(1) || 'test';
          } catch {
            return 'test';
          }
        })();
      return new MongoDBAdapter({ uri, database, maxTextLength });
    }

    case 'mssql': {
      const { MSSQLAdapter } = await import('../adapters/mssql');
      return new MSSQLAdapter({
        server: process.env['MSSQL_HOST'] ?? 'localhost',
        port: Number(process.env['MSSQL_PORT'] ?? 1433),
        database: process.env['MSSQL_DATABASE'] ?? '',
        user: process.env['MSSQL_USER'] ?? '',
        password: process.env['MSSQL_PASSWORD'] ?? '',
        encrypt: process.env['MSSQL_ENCRYPT'] !== 'false',
        trustServerCertificate: process.env['MSSQL_TRUST_CERT'] === 'true',
        maxTextLength,
      });
    }

    case 'prisma': {
      const { PrismaAdapter } = await import('../adapters/prisma');
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const { PrismaClient } = require('@prisma/client');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const prisma = new PrismaClient();
      return new PrismaAdapter(prisma, maxTextLength);
    }

    default:
      throw new Error(`Unsupported DB type: ${String(dbType)}`);
  }
}

// ── Config Builder ───────────────────────────────────────────────────────────
// mcpOnly=true  → DLP_API_KEY is not needed (MCP uses stdio, no HTTP exposure)
// mcpOnly=false → DLP_API_KEY is required to protect the HTTP endpoint
function buildConfig(mcpOnly: boolean): DLPConfig {
  const apiKey = process.env['DLP_API_KEY'];

  if (!mcpOnly && !apiKey) {
    console.warn('[DLP] WARNING: DLP_API_KEY is not set. HTTP server is unprotected!');
    console.warn('[DLP] Set DLP_API_KEY in your .env file to secure the HTTP endpoint.');
  }

  return {
    dbType: detectDBType(),
    port: Number(process.env['PORT'] ?? 3434),
    localhostOnly: process.env['LOCALHOST_ONLY'] !== 'false',
    // In MCP mode the key is never checked — use a placeholder so the type is satisfied
    apiKey: apiKey ?? (mcpOnly ? 'mcp-mode-no-key-needed' : 'no-key-set'),
    maxRows: Number(process.env['MAX_ROWS'] ?? 20),
    defaultPreviewRows: Number(process.env['DEFAULT_PREVIEW_ROWS'] ?? 5),
    maxTextLength: Number(process.env['MAX_TEXT_LENGTH'] ?? 200),
  };
}

// ── Entrypoint ───────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'start';

  switch (command) {
    case 'start': {
      const mcpMode = args.includes('--mcp');
      const httpOnly = args.includes('--http-only');
      const isMcpOnly = mcpMode && !httpOnly;

      const config = buildConfig(isMcpOnly);
      process.stderr.write(`[DLP] Starting (db: ${config.dbType}, mode: ${isMcpOnly ? 'mcp' : 'http'})\n`);

      const adapter = await createAdapter(config.dbType, config);
      await adapter.connect();
      process.stderr.write('[DLP] Database connected\n');

      if (isMcpOnly) {
        await startMCPServer(adapter, config);
      } else {
        await startHttpServer(adapter, config);
      }

      const shutdown = async () => {
        process.stderr.write('\n[DLP] Shutting down...\n');
        await adapter.disconnect();
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      break;
    }

    case 'mcp': {
      // `dlp mcp` — pure MCP stdio mode, no API key needed
      const config = buildConfig(true);
      process.stderr.write(`[DLP] Starting MCP server (db: ${config.dbType})\n`);
      const adapter = await createAdapter(config.dbType, config);
      await adapter.connect();
      process.stderr.write('[DLP] Database connected\n');
      await startMCPServer(adapter, config);
      break;
    }

    case 'set': {
      // `dlp set [ide]` — read DATABASE_URL from local .env and write to IDE MCP configs
      //   dlp set             → ~/.mcp.json + any project configs that already exist
      //   dlp set antigravity → .gemini/antigravity/mcp_config.json  (creates dir)
      //   dlp set cursor      → .cursor/mcp_config.json              (creates dir)
      //   dlp set vscode      → .vscode/mcp_config.json              (creates dir)
      //   dlp set claude      → .claude/mcp_config.json              (creates dir)
      //   dlp set all         → all of the above                     (creates dirs)
      const ideArg = (args[1] ?? '').toLowerCase();

      const home = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '';
      if (!home) {
        console.error('[DLP] Cannot locate home directory.');
        process.exit(1);
      }

      // Read DATABASE_URL from .env in cwd
      let databaseUrl: string | undefined;
      const localEnv = path.join(process.cwd(), '.env');
      if (fs.existsSync(localEnv)) {
        const raw = fs.readFileSync(localEnv, 'utf8');
        const match = raw.match(/^DATABASE_URL\s*=\s*(.+)$/m);
        if (match) databaseUrl = match[1].trim().replace(/^['"]|['"]$/g, '');
      }
      if (!databaseUrl) databaseUrl = process.env['DATABASE_URL'];
      if (!databaseUrl) {
        console.error('[DLP] No DATABASE_URL found. Add it to .env in this directory first:');
        console.error('  DATABASE_URL=postgresql://user:pass@host:5432/mydb');
        process.exit(1);
      }

      // All known IDE targets — all in home dir (global config, not project-local)
      const ideTargets: Record<string, string> = {
        antigravity: path.join(home, '.gemini', 'antigravity', 'mcp_config.json'),
        cursor:      path.join(home, '.cursor',  'mcp_config.json'),
        vscode:      path.join(home, '.vscode',  'mcp_config.json'),
        claude:      path.join(home, '.claude',  'mcp_config.json'),
      };

      // Build list of files to write
      const targets: Array<{ file: string; alwaysWrite: boolean }> = [];

      if (ideArg === '' ) {
        // No IDE specified — write to global config always, project configs only if dir exists
        targets.push({ file: path.join(home, '.mcp.json'), alwaysWrite: true });
        for (const file of Object.values(ideTargets)) {
          targets.push({ file, alwaysWrite: false });
        }
      } else if (ideArg === 'all') {
        // Write to everything, creating dirs as needed
        targets.push({ file: path.join(home, '.mcp.json'), alwaysWrite: true });
        for (const file of Object.values(ideTargets)) {
          targets.push({ file, alwaysWrite: true });
        }
      } else if (ideTargets[ideArg]) {
        // Specific IDE — always create
        targets.push({ file: path.join(home, '.mcp.json'), alwaysWrite: true });
        targets.push({ file: ideTargets[ideArg], alwaysWrite: true });
      } else {
        console.error(`[DLP] Unknown IDE: "${ideArg}"`);
        console.error('  Valid targets: antigravity, cursor, vscode, claude, all');
        process.exit(1);
      }

      // Helper: upsert dlp entry into an MCP config object
      function upsertDlpConfig(cfg: Record<string, unknown>, url: string): void {
        if (!cfg['mcpServers']) cfg['mcpServers'] = {};
        const srv = cfg['mcpServers'] as Record<string, unknown>;
        if (!srv['dlp']) srv['dlp'] = { command: 'npx', args: ['database-lookup-protocol', 'mcp'] };
        const dlpEntry = srv['dlp'] as Record<string, unknown>;
        if (!dlpEntry['env']) dlpEntry['env'] = {};
        const envBlock = dlpEntry['env'] as Record<string, string>;
        envBlock['DATABASE_URL'] = url;
        envBlock['DLP_API_KEY'] = 'not-needed-for-mcp';
      }

      const written: string[] = [];

      for (const { file, alwaysWrite } of targets) {
        const dir = path.dirname(file);
        const fileExists = fs.existsSync(file);
        const dirExists = fs.existsSync(dir);

        if (!alwaysWrite && !fileExists && !dirExists) continue;

        let cfg: Record<string, unknown> = {};
        if (fileExists) {
          try {
            cfg = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
          } catch {
            if (!alwaysWrite) {
              console.warn(`[DLP] Skipping ${file} — invalid JSON`);
              continue;
            }
            // alwaysWrite: user explicitly targeted this IDE — overwrite the broken file
          }
        }

        upsertDlpConfig(cfg, databaseUrl);
        if (!dirExists) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
        written.push(file);
      }

      const short = databaseUrl.length > 60 ? databaseUrl.slice(0, 60) + '...' : databaseUrl;
      console.log(`[DLP] DATABASE_URL: ${short}`);
      console.log('[DLP] Written to:');
      for (const f of written) console.log(`      ${f}`);
      console.log('[DLP] Restart your IDE to apply the change.');
      break;
    }

    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      process.stderr.write('Usage:\n');
      process.stderr.write('  dlp start              Start HTTP server (port 3434)\n');
      process.stderr.write('  dlp start --mcp        Start MCP stdio server only\n');
      process.stderr.write('  dlp start --http-only  Start HTTP server only\n');
      process.stderr.write('  dlp mcp                Alias for start --mcp\n');
      process.stderr.write('  dlp set                Write DATABASE_URL from .env to all found IDE configs\n');
      process.stderr.write('  dlp set antigravity    Write to ~/.gemini/antigravity/mcp_config.json\n');
      process.stderr.write('  dlp set cursor         Write to ~/.cursor/mcp_config.json\n');
      process.stderr.write('  dlp set vscode         Write to ~/.vscode/mcp_config.json\n');
      process.stderr.write('  dlp set claude         Write to ~/.claude/mcp_config.json\n');
      process.stderr.write('  dlp set all            Write to all IDE configs in home dir\n');
      process.exit(1);
  }
}

main().catch(err => {
  process.stderr.write(`[DLP] Fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
