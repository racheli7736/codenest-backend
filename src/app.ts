import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { corsOrigins } from './config/env';
import { openApiDocument } from './docs/openapi';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { categoriesRouter } from './modules/categories/categories.routes';
import { commentsRouter } from './modules/comments/comments.routes';
import { healthRouter } from './modules/health/health.routes';
import { imagesRouter } from './modules/images/images.routes';
import { postsRouter } from './modules/posts/posts.routes';
import { usersRouter } from './modules/users/users.routes';

export function createApp() {
  const app = express();

  // Render (and most clouds) put a proxy in front of the app — needed for correct client IPs.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Allow the React app (a different origin) to show images served by this API.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // This is a JSON API; CSP is relaxed so Swagger UI can run.
      contentSecurityPolicy: false,
    }),
  );
  app.use(cors({ origin: corsOrigins, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/', (_req, res) => {
    res.json({ name: 'CodeNest API', docs: '/api-docs', health: '/api/health' });
  });

  // API documentation
  app.get(['/api-docs.json', '/openapi.json'], (_req, res) => {
    res.json(openApiDocument);
  });
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'CodeNest API Docs',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  // API routes
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/comments', commentsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/images', imagesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
