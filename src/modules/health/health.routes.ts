import { Router } from 'express';
import { prisma } from '../../lib/prisma';

export const healthRouter = Router();

/** Used by Render (and by you) to check that the server AND the database are alive. */
healthRouter.get('/', async (_req, res) => {
  const timestamp = new Date().toISOString();
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'connected', timestamp });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected', timestamp });
  }
});
