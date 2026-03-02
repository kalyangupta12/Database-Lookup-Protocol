import { Router, Request, Response } from 'express';
import { DLPAdapter } from '../adapters/base';
import { DLPRequestSchema, DLPError, DLPConfig } from '../types/protocol';
import { validateSafeQuery } from '../core/validator';
import { compactTableInfo } from '../core/formatter';

export function createRouter(adapter: DLPAdapter, config: DLPConfig): Router {
  const router = Router();

  router.post('/protocol', async (req: Request, res: Response): Promise<void> => {
    const parsed = DLPRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const error: DLPError = {
        error: 'Invalid request',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      };
      res.status(400).json(error);
      return;
    }

    const request = parsed.data;

    try {
      switch (request.action) {
        case 'get_schema': {
          const tables = await adapter.getSchema(request.schema);
          res.json({ tables: compactTableInfo(tables) });
          return;
        }

        case 'preview_table': {
          const limit = Math.min(
            request.limit ?? config.defaultPreviewRows,
            config.maxRows
          );
          const result = await adapter.previewTable(request.table, limit, request.schema);
          res.json(result);
          return;
        }

        case 'describe_table': {
          const table = await adapter.describeTable(request.table, request.schema);
          res.json(table);
          return;
        }

        case 'safe_query': {
          const validation = validateSafeQuery(request.query);
          if (!validation.valid) {
            res.status(400).json(validation.error);
            return;
          }
          const result = await adapter.safeQuery(request.query, config.maxRows);
          res.json(result);
          return;
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const error: DLPError = { error: message, code: 'DB_ERROR' };
      res.status(500).json(error);
    }
  });

  return router;
}
