/**
 * OpenAPI 3 description of the whole CodeNest API.
 * Served as Swagger UI at /api-docs and as JSON at /api-docs.json.
 * `npm run docs:export` writes it to docs/openapi.json.
 */

const LANGUAGES = [
  'JAVASCRIPT', 'TYPESCRIPT', 'PYTHON', 'JAVA', 'CSHARP', 'CPP', 'C', 'PHP',
  'GO', 'RUST', 'KOTLIN', 'SWIFT', 'SQL', 'HTML_CSS', 'OTHER',
];

// ---------- small helpers to keep the document readable ----------
const schemaRef = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const responseRef = (name: string) => ({ $ref: `#/components/responses/${name}` });
const paramRef = (name: string) => ({ $ref: `#/components/parameters/${name}` });
const bearer = [{ bearerAuth: [] }];
/** Public endpoint: works without a token; with a token the answer is personalised (likedByMe…). */
const optionalBearer = [{}, { bearerAuth: [] }];

function jsonBody(schema: object, example?: unknown) {
  return {
    required: true,
    content: { 'application/json': { schema, ...(example !== undefined && { example }) } },
  };
}

function jsonResponse(description: string, schema: object, example?: unknown) {
  return {
    description,
    content: { 'application/json': { schema, ...(example !== undefined && { example }) } },
  };
}

const noContent = { description: 'Success — no content' };

const imageUploadBody = {
  required: true,
  content: {
    'multipart/form-data': {
      schema: {
        type: 'object',
        required: ['image'],
        properties: {
          image: { type: 'string', format: 'binary', description: 'JPG, PNG or WEBP, up to 2MB' },
        },
      },
    },
  },
};

function pageOf(itemSchema: string) {
  return {
    type: 'object',
    required: ['items', 'page', 'limit', 'total', 'totalPages'],
    properties: {
      items: { type: 'array', items: schemaRef(itemSchema) },
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 10 },
      total: { type: 'integer', example: 23 },
      totalPages: { type: 'integer', example: 3 },
    },
  };
}

// ---------- examples ----------
const userSummaryExample = { id: 2, name: 'Noa Cohen', avatarUrl: null };

const currentUserExample = {
  id: 2,
  name: 'Noa Cohen',
  email: 'noa@codenest.dev',
  bio: 'Frontend developer who loves TypeScript',
  role: 'USER',
  avatarUrl: null,
  createdAt: '2026-10-01T09:00:00.000Z',
};

const postExample = {
  id: 12,
  title: 'Tip: Optional chaining',
  content: 'Instead of checking every level of an object, use ?. to stop safely at the first null.',
  codeSnippet: 'const city = user?.address?.city;',
  language: 'JAVASCRIPT',
  imageUrl: '/api/images/3f2b6a10-6c1e-4e0b-9c55-1f4a7c2d9e91',
  category: { id: 1, name: 'Tips' },
  author: userSummaryExample,
  likesCount: 5,
  commentsCount: 2,
  likedByMe: true,
  savedByMe: false,
  createdAt: '2026-10-14T09:30:00.000Z',
  updatedAt: '2026-10-14T09:30:00.000Z',
};

const commentExample = {
  id: 7,
  content: 'Great tip, thanks!',
  postId: 12,
  author: { id: 3, name: 'Dan Levi', avatarUrl: null },
  createdAt: '2026-10-14T10:00:00.000Z',
};

const categoryExample = {
  id: 1,
  name: 'Tips',
  description: 'Short, practical coding tips',
  postsCount: 4,
  createdAt: '2026-10-01T09:00:00.000Z',
};

const page = (items: unknown[]) => ({ items, page: 1, limit: 10, total: items.length, totalPages: 1 });

// ---------- the document ----------
export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'CodeNest API',
    version: '1.0.0',
    description: [
      'REST API for **CodeNest** — a knowledge-sharing social network for programmers.',
      '',
      '### How to try protected endpoints',
      '1. Open **POST /api/auth/login**, click **Try it out**, and log in (demo users are listed in the README).',
      '2. Copy the `token` from the response.',
      '3. Click the green **Authorize** button at the top, paste the token (without the word Bearer) and click **Authorize**.',
      '4. Now every 🔒 endpoint will send `Authorization: Bearer <token>` automatically.',
      '',
      'Reading posts, comments, categories and profiles is open to guests (no token). Liking, saving, commenting, following and creating require login.',
      '',
      'Every error has the same shape: `{ "error": { "code", "message", "details?" } }`.',
    ].join('\n'),
  },
  // Relative URL → works both on localhost and after deployment to the cloud.
  servers: [{ url: '/', description: 'This server' }],
  tags: [
    { name: 'Health', description: 'Server status' },
    { name: 'Auth', description: 'Register, log in, current user' },
    { name: 'Me', description: 'My personal area, profile and saved posts' },
    { name: 'Users', description: 'Profiles and following' },
    { name: 'Posts', description: 'Posts, likes and saves' },
    { name: 'Comments', description: 'Comments on posts' },
    { name: 'Categories', description: 'Post categories (managed by admins)' },
    { name: 'Images', description: 'Uploaded images' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the token you got from /api/auth/login (without the word "Bearer").',
      },
    },
    parameters: {
      IdPath: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'integer', minimum: 1 },
        example: 1,
      },
      Page: {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', minimum: 1, default: 1 },
        description: 'Page number (starts at 1)',
      },
      Limit: {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
        description: 'Items per page (max 50)',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'NOT_FOUND' },
              message: { type: 'string', example: 'Post not found' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { field: { type: 'string' }, message: { type: 'string' } },
                },
              },
            },
          },
        },
      },
      Role: { type: 'string', enum: ['USER', 'ADMIN'] },
      ProgrammingLanguage: { type: 'string', enum: LANGUAGES },
      Health: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'error'] },
          database: { type: 'string', enum: ['connected', 'disconnected'] },
          storage: {
            type: 'string',
            enum: ['r2', 'memory', 'not_configured'],
            description: 'Active image storage. "r2" = Cloudflare R2 (production)',
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      UserSummary: {
        type: 'object',
        description: 'Short user info shown next to posts and comments',
        required: ['id', 'name', 'avatarUrl'],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          avatarUrl: { type: 'string', nullable: true, description: 'Relative URL — prefix with the API base URL' },
        },
      },
      ListedUser: {
        type: 'object',
        required: ['id', 'name', 'avatarUrl', 'bio'],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          avatarUrl: { type: 'string', nullable: true },
          bio: { type: 'string', nullable: true },
        },
      },
      CurrentUser: {
        type: 'object',
        description: 'The logged-in user (includes private email). Never includes the password.',
        required: ['id', 'name', 'email', 'bio', 'role', 'avatarUrl', 'createdAt'],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          bio: { type: 'string', nullable: true },
          role: schemaRef('Role'),
          avatarUrl: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AdminUserListItem: {
        allOf: [
          schemaRef('CurrentUser'),
          { type: 'object', properties: { postsCount: { type: 'integer' } } },
        ],
      },
      UserProfile: {
        type: 'object',
        required: [
          'id', 'name', 'email', 'bio', 'role', 'avatarUrl', 'createdAt',
          'postsCount', 'followersCount', 'followingCount', 'isFollowedByMe', 'isMe',
        ],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          email: {
            type: 'string',
            nullable: true,
            description: 'Visible only to the profile owner and to admins; null for everyone else',
          },
          bio: { type: 'string', nullable: true },
          role: schemaRef('Role'),
          avatarUrl: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          postsCount: { type: 'integer' },
          followersCount: { type: 'integer' },
          followingCount: { type: 'integer' },
          isFollowedByMe: { type: 'boolean' },
          isMe: { type: 'boolean' },
        },
      },
      Dashboard: {
        type: 'object',
        required: ['user', 'stats'],
        properties: {
          user: schemaRef('CurrentUser'),
          stats: {
            type: 'object',
            required: ['postsCount', 'followersCount', 'followingCount', 'savedCount', 'likesReceived'],
            properties: {
              postsCount: { type: 'integer', description: 'Posts I wrote' },
              followersCount: { type: 'integer', description: 'People following me' },
              followingCount: { type: 'integer', description: 'People I follow' },
              savedCount: { type: 'integer', description: 'Posts I saved' },
              likesReceived: { type: 'integer', description: 'Total likes on all my posts' },
            },
          },
        },
      },
      AuthResponse: {
        type: 'object',
        required: ['token', 'user'],
        properties: {
          token: { type: 'string', description: 'JWT access token — send as "Authorization: Bearer <token>"' },
          user: schemaRef('CurrentUser'),
        },
      },
      RegisterInput: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 50 },
          email: { type: 'string', format: 'email', maxLength: 255 },
          password: {
            type: 'string',
            minLength: 8,
            maxLength: 72,
            description: 'At least 8 characters, with at least one letter and one digit',
          },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
      },
      UpdateMeInput: {
        type: 'object',
        description: 'Send at least one field',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 50 },
          bio: { type: 'string', maxLength: 300, nullable: true, description: 'Send "" or null to clear' },
        },
      },
      Category: {
        type: 'object',
        required: ['id', 'name', 'description', 'postsCount', 'createdAt'],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          postsCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CategoryInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 40 },
          description: { type: 'string', maxLength: 200, nullable: true },
        },
      },
      CategoryUpdateInput: {
        type: 'object',
        description: 'Send at least one field',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 40 },
          description: { type: 'string', maxLength: 200, nullable: true },
        },
      },
      Post: {
        type: 'object',
        required: [
          'id', 'title', 'content', 'codeSnippet', 'language', 'imageUrl', 'category', 'author',
          'likesCount', 'commentsCount', 'likedByMe', 'savedByMe', 'createdAt', 'updatedAt',
        ],
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          content: { type: 'string' },
          codeSnippet: { type: 'string', nullable: true },
          language: { allOf: [schemaRef('ProgrammingLanguage')], nullable: true },
          imageUrl: { type: 'string', nullable: true },
          category: {
            type: 'object',
            properties: { id: { type: 'integer' }, name: { type: 'string' } },
          },
          author: schemaRef('UserSummary'),
          likesCount: { type: 'integer' },
          commentsCount: { type: 'integer' },
          likedByMe: { type: 'boolean' },
          savedByMe: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreatePostInput: {
        type: 'object',
        required: ['title', 'content', 'categoryId'],
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 120 },
          content: { type: 'string', minLength: 1, maxLength: 5000 },
          codeSnippet: { type: 'string', maxLength: 10000, nullable: true },
          language: { allOf: [schemaRef('ProgrammingLanguage')], nullable: true },
          categoryId: { type: 'integer', minimum: 1 },
        },
      },
      UpdatePostInput: {
        type: 'object',
        description: 'Send only the fields you want to change (at least one)',
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 120 },
          content: { type: 'string', minLength: 1, maxLength: 5000 },
          codeSnippet: { type: 'string', maxLength: 10000, nullable: true },
          language: { allOf: [schemaRef('ProgrammingLanguage')], nullable: true },
          categoryId: { type: 'integer', minimum: 1 },
        },
      },
      LikeStatus: {
        type: 'object',
        required: ['likesCount', 'likedByMe'],
        properties: { likesCount: { type: 'integer' }, likedByMe: { type: 'boolean' } },
      },
      SaveStatus: {
        type: 'object',
        required: ['savedByMe'],
        properties: { savedByMe: { type: 'boolean' } },
      },
      Comment: {
        type: 'object',
        required: ['id', 'content', 'postId', 'author', 'createdAt'],
        properties: {
          id: { type: 'integer' },
          content: { type: 'string' },
          postId: { type: 'integer' },
          author: schemaRef('UserSummary'),
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CommentInput: {
        type: 'object',
        required: ['content'],
        properties: { content: { type: 'string', minLength: 1, maxLength: 1000 } },
      },
      PostPage: pageOf('Post'),
      CommentPage: pageOf('Comment'),
      ListedUserPage: pageOf('ListedUser'),
      AdminUserPage: pageOf('AdminUserListItem'),
    },
    responses: {
      ValidationError: jsonResponse('400 — invalid or missing fields', schemaRef('Error'), {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Some fields are missing or invalid',
          details: [{ field: 'title', message: 'Title must be at least 3 characters' }],
        },
      }),
      Unauthorized: jsonResponse('401 — missing, invalid or expired token', schemaRef('Error'), {
        error: { code: 'TOKEN_MISSING', message: 'Missing Bearer token in the Authorization header' },
      }),
      Forbidden: jsonResponse('403 — logged in, but not allowed to do this', schemaRef('Error'), {
        error: { code: 'FORBIDDEN', message: 'You do not have permission to do this' },
      }),
      NotFound: jsonResponse('404 — not found', schemaRef('Error'), {
        error: { code: 'NOT_FOUND', message: 'Post not found' },
      }),
      Conflict: jsonResponse('409 — conflicts with existing data', schemaRef('Error'), {
        error: { code: 'CONFLICT', message: 'A record with this value already exists' },
      }),
      FileTooLarge: jsonResponse('413 — image is larger than 2MB', schemaRef('Error'), {
        error: { code: 'FILE_TOO_LARGE', message: 'Image must be 2MB or smaller' },
      }),
      StorageError: jsonResponse('502 — image storage (Cloudflare R2) is temporarily unavailable', schemaRef('Error'), {
        error: { code: 'STORAGE_ERROR', message: 'Image storage is temporarily unavailable, please try again' },
      }),
      StorageNotConfigured: jsonResponse('503 — image storage is not configured on the server', schemaRef('Error'), {
        error: {
          code: 'STORAGE_NOT_CONFIGURED',
          message: 'Image storage is not configured on the server (missing Cloudflare R2 settings)',
        },
      }),
      TooManyRequests: jsonResponse('429 — too many attempts', schemaRef('Error'), {
        error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, please try again in a few minutes' },
      }),
    },
  },
  paths: {
    // ===================== Health =====================
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Check that the server and database are running',
        description: 'Public. Returns 200 when everything works, 503 if the database is unreachable.',
        responses: {
          200: jsonResponse('Server is healthy', schemaRef('Health'), {
            status: 'ok',
            database: 'connected',
            storage: 'r2',
            timestamp: '2026-10-14T10:00:00.000Z',
          }),
          503: jsonResponse('Database is not reachable', schemaRef('Health')),
        },
      },
    },

    // ===================== Auth =====================
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create a new account (always role USER)',
        description: 'Public. Returns a token so the user is logged in right away.',
        requestBody: jsonBody(schemaRef('RegisterInput'), {
          name: 'Maya Israeli',
          email: 'maya@example.com',
          password: 'Secret123',
        }),
        responses: {
          201: jsonResponse('Account created', schemaRef('AuthResponse'), {
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            user: { ...currentUserExample, id: 5, name: 'Maya Israeli', email: 'maya@example.com', bio: null },
          }),
          400: responseRef('ValidationError'),
          409: jsonResponse('Email already registered', schemaRef('Error'), {
            error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists' },
          }),
          429: responseRef('TooManyRequests'),
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in and get a JWT token',
        description: 'Public. Copy the `token` from the response and paste it into **Authorize**.',
        requestBody: jsonBody(schemaRef('LoginInput'), {
          email: 'noa@codenest.dev',
          password: 'User1234!',
        }),
        responses: {
          200: jsonResponse('Logged in', schemaRef('AuthResponse'), {
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            user: currentUserExample,
          }),
          400: responseRef('ValidationError'),
          401: jsonResponse('Wrong email or password', schemaRef('Error'), {
            error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' },
          }),
          429: responseRef('TooManyRequests'),
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Who am I? (the user of the current token)',
        security: bearer,
        responses: {
          200: jsonResponse(
            'Current user',
            { type: 'object', properties: { user: schemaRef('CurrentUser') } },
            { user: currentUserExample },
          ),
          401: responseRef('Unauthorized'),
        },
      },
    },

    // ===================== Me =====================
    '/api/users/me/dashboard': {
      get: {
        tags: ['Me'],
        summary: 'My personal area — profile + counters in one call',
        description:
          'For the "My posts" tab use `GET /api/posts?authorId=<my id>`; for the "Saved" tab use `GET /api/users/me/saved-posts`.',
        security: bearer,
        responses: {
          200: jsonResponse('Dashboard data', schemaRef('Dashboard'), {
            user: currentUserExample,
            stats: { postsCount: 3, followersCount: 2, followingCount: 1, savedCount: 2, likesReceived: 7 },
          }),
          401: responseRef('Unauthorized'),
        },
      },
    },
    '/api/users/me': {
      patch: {
        tags: ['Me'],
        summary: 'Edit my profile (name, bio)',
        security: bearer,
        requestBody: jsonBody(schemaRef('UpdateMeInput'), { name: 'Noa C.', bio: 'Full-stack learner' }),
        responses: {
          200: jsonResponse(
            'Updated profile',
            { type: 'object', properties: { user: schemaRef('CurrentUser') } },
            { user: { ...currentUserExample, name: 'Noa C.', bio: 'Full-stack learner' } },
          ),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
        },
      },
    },
    '/api/users/me/avatar': {
      put: {
        tags: ['Me'],
        summary: 'Upload / replace my profile picture',
        description:
          'Send `multipart/form-data` with one file in the field **image** (JPG/PNG/WEBP, max 2MB). ' +
          'The file is stored in Cloudflare R2; the old image file is removed.',
        security: bearer,
        requestBody: imageUploadBody,
        responses: {
          200: jsonResponse(
            'Profile picture saved',
            { type: 'object', properties: { user: schemaRef('CurrentUser') } },
            { user: { ...currentUserExample, avatarUrl: '/api/images/9d1c0a52-2f7e-4c3b-8a6d-5e4f3b2a1c0d' } },
          ),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          413: responseRef('FileTooLarge'),
          502: responseRef('StorageError'),
          503: responseRef('StorageNotConfigured'),
        },
      },
      delete: {
        tags: ['Me'],
        summary: 'Remove my profile picture',
        security: bearer,
        responses: { 204: noContent, 401: responseRef('Unauthorized') },
      },
    },
    '/api/users/me/saved-posts': {
      get: {
        tags: ['Me'],
        summary: 'My saved posts (private — only mine)',
        security: bearer,
        parameters: [paramRef('Page'), paramRef('Limit')],
        responses: {
          200: jsonResponse('Saved posts, most recently saved first', schemaRef('PostPage'),
            page([{ ...postExample, savedByMe: true }])),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
        },
      },
    },

    // ===================== Users =====================
    '/api/users': {
      get: {
        tags: ['Users'],
        summary: '👑 Admin: list all users (with email and role)',
        security: bearer,
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search in name or email' },
          paramRef('Page'),
          paramRef('Limit'),
        ],
        responses: {
          200: jsonResponse('Users', schemaRef('AdminUserPage'), page([{ ...currentUserExample, postsCount: 3 }])),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          403: responseRef('Forbidden'),
        },
      },
    },
    '/api/users/{id}': {
      get: {
        tags: ['Users'],
        summary: "A user's public profile (🔓 also for guests)",
        description: 'Works without a token. The email is returned only for your own profile or if you are an admin (otherwise null). Guests get isFollowedByMe=false and isMe=false.',
        security: optionalBearer,
        parameters: [paramRef('IdPath')],
        responses: {
          200: jsonResponse(
            'Profile',
            { type: 'object', properties: { user: schemaRef('UserProfile') } },
            {
              user: {
                ...currentUserExample,
                email: null,
                postsCount: 3,
                followersCount: 2,
                followingCount: 1,
                isFollowedByMe: true,
                isMe: false,
              },
            },
          ),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          404: responseRef('NotFound'),
        },
      },
    },
    '/api/users/{id}/followers': {
      get: {
        tags: ['Users'],
        summary: 'People who follow this user (🔓 also for guests)',
        security: optionalBearer,
        parameters: [paramRef('IdPath'), paramRef('Page'), paramRef('Limit')],
        responses: {
          200: jsonResponse('Followers', schemaRef('ListedUserPage'),
            page([{ id: 3, name: 'Dan Levi', avatarUrl: null, bio: 'Backend & Python' }])),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          404: responseRef('NotFound'),
        },
      },
    },
    '/api/users/{id}/following': {
      get: {
        tags: ['Users'],
        summary: 'People this user follows (🔓 also for guests)',
        security: optionalBearer,
        parameters: [paramRef('IdPath'), paramRef('Page'), paramRef('Limit')],
        responses: {
          200: jsonResponse('Following', schemaRef('ListedUserPage'),
            page([{ id: 2, name: 'Noa Cohen', avatarUrl: null, bio: null }])),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          404: responseRef('NotFound'),
        },
      },
    },
    '/api/users/{id}/follow': {
      post: {
        tags: ['Users'],
        summary: 'Follow this user',
        description: 'Following someone you already follow is harmless (still 204). You cannot follow yourself.',
        security: bearer,
        parameters: [paramRef('IdPath')],
        responses: {
          204: noContent,
          400: jsonResponse('Invalid id, or trying to follow yourself', schemaRef('Error'), {
            error: { code: 'CANNOT_FOLLOW_SELF', message: 'You cannot follow yourself' },
          }),
          401: responseRef('Unauthorized'),
          404: responseRef('NotFound'),
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Stop following this user',
        security: bearer,
        parameters: [paramRef('IdPath')],
        responses: {
          204: noContent,
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          404: responseRef('NotFound'),
        },
      },
    },

    // ===================== Posts =====================
    '/api/posts': {
      get: {
        tags: ['Posts'],
        summary: 'List posts — search, filter, sort and pages (🔓 also for guests)',
        description: 'Works without a token (guests: likedByMe/savedByMe are false). `feed=following` requires login. All filters can be combined. Example: `/api/posts?search=react&language=TYPESCRIPT&sort=popular`',
        security: optionalBearer,
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string', maxLength: 100 }, description: 'Text in title or content (case-insensitive)' },
          { name: 'categoryId', in: 'query', schema: { type: 'integer' } },
          { name: 'language', in: 'query', schema: schemaRef('ProgrammingLanguage') },
          { name: 'authorId', in: 'query', schema: { type: 'integer' }, description: 'Posts of one user (profile page / "My posts")' },
          { name: 'feed', in: 'query', schema: { type: 'string', enum: ['all', 'following'], default: 'all' }, description: '"following" = only posts by people I follow' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['newest', 'popular'], default: 'newest' }, description: '"popular" = most likes first' },
          paramRef('Page'),
          paramRef('Limit'),
        ],
        responses: {
          200: jsonResponse('A page of posts', schemaRef('PostPage'), page([postExample])),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
        },
      },
      post: {
        tags: ['Posts'],
        summary: 'Create a post',
        description: 'The author is always the logged-in user. To add an image, call `PUT /api/posts/{id}/image` afterwards.',
        security: bearer,
        requestBody: jsonBody(schemaRef('CreatePostInput'), {
          title: 'Tip: Optional chaining',
          content: 'Instead of checking every level of an object, use ?. to stop safely at the first null.',
          codeSnippet: 'const city = user?.address?.city;',
          language: 'JAVASCRIPT',
          categoryId: 1,
        }),
        responses: {
          201: jsonResponse('Post created', { type: 'object', properties: { post: schemaRef('Post') } },
            { post: { ...postExample, imageUrl: null, likesCount: 0, commentsCount: 0, likedByMe: false } }),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
        },
      },
    },
    '/api/posts/{id}': {
      get: {
        tags: ['Posts'],
        summary: 'Get one post (🔓 also for guests)',
        security: optionalBearer,
        parameters: [paramRef('IdPath')],
        responses: {
          200: jsonResponse('The post', { type: 'object', properties: { post: schemaRef('Post') } }, { post: postExample }),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          404: responseRef('NotFound'),
        },
      },
      patch: {
        tags: ['Posts'],
        summary: 'Edit my post (owner only)',
        security: bearer,
        parameters: [paramRef('IdPath')],
        requestBody: jsonBody(schemaRef('UpdatePostInput'), { title: 'Tip: Optional chaining in JS' }),
        responses: {
          200: jsonResponse('Updated post', { type: 'object', properties: { post: schemaRef('Post') } },
            { post: { ...postExample, title: 'Tip: Optional chaining in JS' } }),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          403: responseRef('Forbidden'),
          404: responseRef('NotFound'),
        },
      },
      delete: {
        tags: ['Posts'],
        summary: 'Delete a post (owner or 👑 admin)',
        description: 'Also deletes its comments, likes, saves and image.',
        security: bearer,
        parameters: [paramRef('IdPath')],
        responses: {
          204: noContent,
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          403: responseRef('Forbidden'),
          404: responseRef('NotFound'),
        },
      },
    },
    '/api/posts/{id}/image': {
      put: {
        tags: ['Posts'],
        summary: 'Upload / replace the post image (owner only)',
        description:
          'Send `multipart/form-data` with one file in the field **image** (JPG/PNG/WEBP, max 2MB). ' +
          'The file is stored in Cloudflare R2; the old image file is removed.',
        security: bearer,
        parameters: [paramRef('IdPath')],
        requestBody: imageUploadBody,
        responses: {
          200: jsonResponse('Post with its new image', { type: 'object', properties: { post: schemaRef('Post') } }, { post: postExample }),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          403: responseRef('Forbidden'),
          404: responseRef('NotFound'),
          413: responseRef('FileTooLarge'),
          502: responseRef('StorageError'),
          503: responseRef('StorageNotConfigured'),
        },
      },
      delete: {
        tags: ['Posts'],
        summary: 'Remove the post image (owner only)',
        security: bearer,
        parameters: [paramRef('IdPath')],
        responses: {
          204: noContent,
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          403: responseRef('Forbidden'),
          404: responseRef('NotFound'),
        },
      },
    },
    '/api/posts/{id}/like': {
      post: {
        tags: ['Posts'],
        summary: 'Like a post',
        description: 'Liking twice is harmless — the like is counted once.',
        security: bearer,
        parameters: [paramRef('IdPath')],
        responses: {
          200: jsonResponse('Like status', schemaRef('LikeStatus'), { likesCount: 6, likedByMe: true }),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          404: responseRef('NotFound'),
        },
      },
      delete: {
        tags: ['Posts'],
        summary: 'Remove my like',
        security: bearer,
        parameters: [paramRef('IdPath')],
        responses: {
          200: jsonResponse('Like status', schemaRef('LikeStatus'), { likesCount: 5, likedByMe: false }),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          404: responseRef('NotFound'),
        },
      },
    },
    '/api/posts/{id}/save': {
      post: {
        tags: ['Posts'],
        summary: 'Save a post for later',
        security: bearer,
        parameters: [paramRef('IdPath')],
        responses: {
          200: jsonResponse('Save status', schemaRef('SaveStatus'), { savedByMe: true }),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          404: responseRef('NotFound'),
        },
      },
      delete: {
        tags: ['Posts'],
        summary: 'Remove from my saved posts',
        security: bearer,
        parameters: [paramRef('IdPath')],
        responses: {
          200: jsonResponse('Save status', schemaRef('SaveStatus'), { savedByMe: false }),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          404: responseRef('NotFound'),
        },
      },
    },

    // ===================== Comments =====================
    '/api/posts/{id}/comments': {
      get: {
        tags: ['Comments'],
        summary: 'Comments of a post, oldest first (🔓 also for guests)',
        security: optionalBearer,
        parameters: [paramRef('IdPath'), paramRef('Page'), paramRef('Limit')],
        responses: {
          200: jsonResponse('A page of comments', schemaRef('CommentPage'), page([commentExample])),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          404: responseRef('NotFound'),
        },
      },
      post: {
        tags: ['Comments'],
        summary: 'Add a comment to a post',
        security: bearer,
        parameters: [paramRef('IdPath')],
        requestBody: jsonBody(schemaRef('CommentInput'), { content: 'Great tip, thanks!' }),
        responses: {
          201: jsonResponse('Comment created', { type: 'object', properties: { comment: schemaRef('Comment') } }, { comment: commentExample }),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          404: responseRef('NotFound'),
        },
      },
    },
    '/api/comments/{id}': {
      delete: {
        tags: ['Comments'],
        summary: 'Delete a comment (owner or 👑 admin)',
        security: bearer,
        parameters: [paramRef('IdPath')],
        responses: {
          204: noContent,
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          403: responseRef('Forbidden'),
          404: responseRef('NotFound'),
        },
      },
    },

    // ===================== Categories =====================
    '/api/categories': {
      get: {
        tags: ['Categories'],
        summary: 'All categories for filters and the post form (🔓 also for guests)',
        security: optionalBearer,
        responses: {
          200: jsonResponse(
            'Categories sorted by name',
            { type: 'object', properties: { items: { type: 'array', items: schemaRef('Category') } } },
            { items: [categoryExample] },
          ),
          401: responseRef('Unauthorized'),
        },
      },
      post: {
        tags: ['Categories'],
        summary: '👑 Admin: add a category',
        security: bearer,
        requestBody: jsonBody(schemaRef('CategoryInput'), { name: 'DevOps', description: 'CI/CD, Docker and the cloud' }),
        responses: {
          201: jsonResponse('Category created', { type: 'object', properties: { category: schemaRef('Category') } },
            { category: { ...categoryExample, id: 6, name: 'DevOps', description: 'CI/CD, Docker and the cloud', postsCount: 0 } }),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          403: responseRef('Forbidden'),
          409: jsonResponse('Name already exists', schemaRef('Error'), {
            error: { code: 'CATEGORY_EXISTS', message: 'A category named "DevOps" already exists' },
          }),
        },
      },
    },
    '/api/categories/{id}': {
      patch: {
        tags: ['Categories'],
        summary: '👑 Admin: edit a category',
        security: bearer,
        parameters: [paramRef('IdPath')],
        requestBody: jsonBody(schemaRef('CategoryUpdateInput'), { description: 'Short and practical tips' }),
        responses: {
          200: jsonResponse('Updated category', { type: 'object', properties: { category: schemaRef('Category') } },
            { category: { ...categoryExample, description: 'Short and practical tips' } }),
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          403: responseRef('Forbidden'),
          404: responseRef('NotFound'),
          409: responseRef('Conflict'),
        },
      },
      delete: {
        tags: ['Categories'],
        summary: '👑 Admin: delete an empty category',
        description: 'A category that still has posts cannot be deleted (409 CATEGORY_IN_USE).',
        security: bearer,
        parameters: [paramRef('IdPath')],
        responses: {
          204: noContent,
          400: responseRef('ValidationError'),
          401: responseRef('Unauthorized'),
          403: responseRef('Forbidden'),
          404: responseRef('NotFound'),
          409: jsonResponse('Category still has posts', schemaRef('Error'), {
            error: { code: 'CATEGORY_IN_USE', message: 'This category still has 4 post(s). Move or delete them first.' },
          }),
        },
      },
    },

    // ===================== Images =====================
    '/api/images/{id}': {
      get: {
        tags: ['Images'],
        summary: 'Get an uploaded image file',
        description: [
          'Public (an <img> tag cannot send a token). Ids are random UUIDs that cannot be guessed.',
          'Use the `imageUrl` / `avatarUrl` you got from other endpoints directly in `<img src>`.',
          '',
          '- Images stored in **Cloudflare R2** answer **302** with a short-lived signed URL; browsers follow it automatically.',
          '- Older images not migrated yet are sent directly (**200**).',
          '',
          '_Swagger "Try it out" may show the redirect as a network error because of CORS — open the URL in a new tab instead._',
        ].join('\n'),
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            description: 'The image file (legacy images stored in the database)',
            content: {
              'image/jpeg': { schema: { type: 'string', format: 'binary' } },
              'image/png': { schema: { type: 'string', format: 'binary' } },
              'image/webp': { schema: { type: 'string', format: 'binary' } },
            },
          },
          302: {
            description: 'Redirect to the image in Cloudflare R2 (signed URL, valid for a limited time)',
            headers: {
              Location: { description: 'Temporary URL of the image file', schema: { type: 'string', format: 'uri' } },
            },
          },
          404: responseRef('NotFound'),
          502: responseRef('StorageError'),
          503: responseRef('StorageNotConfigured'),
        },
      },
    },
  },
};
