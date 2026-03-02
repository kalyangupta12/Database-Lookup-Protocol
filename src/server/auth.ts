import { Request, Response, NextFunction } from 'express';
import { DLPError } from '../types/protocol';

export function createAuthMiddleware(apiKey: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const fromBearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined;
    const fromHeader = req.headers['x-api-key'] as string | undefined;
    const fromQuery = req.query['apiKey'] as string | undefined;

    const provided = fromBearer ?? fromHeader ?? fromQuery;

    if (!provided) {
      const error: DLPError = { error: 'API key required', code: 'AUTH_ERROR' };
      res.status(401).json(error);
      return;
    }

    if (provided !== apiKey) {
      const error: DLPError = { error: 'Invalid API key', code: 'AUTH_ERROR' };
      res.status(403).json(error);
      return;
    }

    next();
  };
}
