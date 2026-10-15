import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

const app = createApp();

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`CodeNest API running on port ${env.PORT} (${env.NODE_ENV})`);
  console.log(`Swagger docs: http://localhost:${env.PORT}/api-docs`);
});

// Close cleanly when the cloud host stops or restarts the server
async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
