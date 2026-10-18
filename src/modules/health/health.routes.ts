import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { getStorage } from '../../lib/storage';

export const healthRouter = Router();

/** Used by Render (and by you) to check that the server AND the database are alive.
 * `storage` shows which image storage is active (it does not call R2, so the check stays fast). */
healthRouter.get('/', async (_req, res) => {
  const timestamp = new Date().toISOString();
  const storage = getStorage().driver;
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'connected', storage, timestamp });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected', storage, timestamp });
  }
});
