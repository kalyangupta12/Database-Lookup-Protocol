import express from 'express';
import cors from 'cors';
import { DLPAdapter } from '../adapters/base';
import { DLPConfig } from '../types/protocol';
import { createAuthMiddleware } from './auth';
import { createRouter } from './router';

export function createApp(adapter: DLPAdapter, config: DLPConfig) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // Health check — unauthenticated
  app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }));

  // Protocol endpoint requires API key auth
  app.use('/protocol', createAuthMiddleware(config.apiKey));
  app.use('/', createRouter(adapter, config));

  return app;
}

export async function startHttpServer(
  adapter: DLPAdapter,
  config: DLPConfig
): Promise<void> {
  const app = createApp(adapter, config);
  const host = config.localhostOnly ? '127.0.0.1' : '0.0.0.0';

  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, host, () => {
      console.log(`[DLP] HTTP server listening on http://${host}:${config.port}`);
      console.log(`[DLP] POST http://${host}:${config.port}/protocol`);
      resolve();
    });
    server.on('error', reject);
  });
}
