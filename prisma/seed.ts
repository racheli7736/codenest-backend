/**
 * Demo data for CodeNest. Safe to run many times — it never duplicates data
 * and never overwrites existing passwords.
 *
 * Development (NODE_ENV != production):
 *   creates categories + demo admin + 2 demo users with the KNOWN passwords below + posts, likes, follows...
 *
 * Production (NODE_ENV = production), nothing with a known password is created:
 *   - categories are created only if there are none yet
 *   - an admin is created only if SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are set
 *   - demo users + posts are created only if SEED_DEMO_PASSWORD is set (you choose the password)
 */
import 'dotenv/config';
import { PrismaClient, type ProgrammingLanguage } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === 'production';

const DEV_ADMIN = { email: 'admin@codenest.dev', password: 'Admin1234!' };
const DEV_USER_PASSWORD = 'User1234!';

const CATEGORIES = [
  { name: 'Tips', description: 'Short, practical coding tips' },
  { name: 'Bugs & Fixes', description: 'A bug I hit and how I solved it' },
  { name: 'Tools', description: 'Editors, libraries and developer tools' },
  { name: 'Architecture', description: 'Clean code, design and project structure' },
  { name: 'Career & Learning', description: 'Learning paths, interviews and growth' },
];

const DEMO_USERS = [
  { key: 'noa', name: 'Noa Cohen', email: 'noa@codenest.dev', bio: 'Frontend developer who loves TypeScript' },
  { key: 'dan', name: 'Dan Levi', email: 'dan@codenest.dev', bio: 'Backend & Python. Coffee-driven development.' },
  { key: 'yael', name: 'Yael Mizrahi', email: 'yael@codenest.dev', bio: 'Student, learning Java and SQL' },
] as const;

type DemoKey = (typeof DEMO_USERS)[number]['key'];

const DEMO_POSTS: {
  author: DemoKey;
  category: string;
  title: string;
  content: string;
  codeSnippet?: string;
  language?: ProgrammingLanguage;
}[] = [
  {
    author: 'noa',
    category: 'Tips',
    title: 'Tip: Optional chaining in JavaScript',
    content: 'Instead of checking every level of an object, use ?. to stop safely at the first null or undefined.',
    codeSnippet: 'const city = user?.address?.city ?? "Unknown";',
    language: 'JAVASCRIPT',
  },
  {
    author: 'noa',
    category: 'Tips',
    title: 'TypeScript: use "satisfies" for config objects',
    content: 'satisfies checks the type but keeps the exact literal types — great for route maps and settings.',
    codeSnippet: 'const routes = {\n  home: "/",\n  profile: "/me",\n} satisfies Record<string, string>;',
    language: 'TYPESCRIPT',
  },
  {
    author: 'noa',
    category: 'Bugs & Fixes',
    title: 'useEffect ran twice in development',
    content: 'React StrictMode mounts components twice in development on purpose. Make your effects clean up after themselves.',
    language: 'TYPESCRIPT',
  },
  {
    author: 'dan',
    category: 'Tips',
    title: 'Python list comprehensions',
    content: 'A short way to build a list from another list, with an optional filter.',
    codeSnippet: 'squares = [n * n for n in range(10) if n % 2 == 0]',
    language: 'PYTHON',
  },
  {
    author: 'dan',
    category: 'Architecture',
    title: 'Why I split routes, controllers and services',
    content: 'Routes map URLs, controllers read the request, services hold the business logic. Each part is easy to test alone.',
  },
  {
    author: 'dan',
    category: 'Tools',
    title: 'Prisma Studio — a GUI for your database',
    content: 'Run npx prisma studio to browse and edit your tables in the browser. Very handy while developing.',
    codeSnippet: 'npx prisma studio',
    language: 'OTHER',
  },
  {
    author: 'yael',
    category: 'Bugs & Fixes',
    title: 'SQL: why my COUNT was wrong after a JOIN',
    content: 'A JOIN can duplicate rows. Use COUNT(DISTINCT id) or count in a subquery.',
    codeSnippet: 'SELECT p.id, COUNT(DISTINCT l.user_id) AS likes\nFROM posts p\nLEFT JOIN likes l ON l.post_id = p.id\nGROUP BY p.id;',
    language: 'SQL',
  },
  {
    author: 'yael',
    category: 'Career & Learning',
    title: 'How I practice Java every day',
    content: 'One small exercise every morning, and I write down what I learned. Consistency beats long weekends.',
    language: 'JAVA',
  },
];

async function ensureCategories() {
  if ((await prisma.category.count()) > 0) return; // never re-create categories an admin deleted
  await prisma.category.createMany({ data: CATEGORIES });
  console.log(`✔ Created ${CATEGORIES.length} categories`);
}

async function ensureAdmin(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== 'ADMIN') await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    console.log(`✔ Admin ${email} already exists (password not changed)`);
    return;
  }
  await prisma.user.create({
    data: { email, name, role: 'ADMIN', passwordHash: await hash(password, 10), bio: 'Keeps CodeNest tidy' },
  });
  console.log(`✔ Created admin ${email}`);
}

async function ensureDemoContent(password: string) {
  if (await prisma.user.findUnique({ where: { email: DEMO_USERS[0].email } })) {
    console.log('✔ Demo content already exists');
    return;
  }

  const passwordHash = await hash(password, 10);
  const users = {} as Record<DemoKey, number>;
  for (const demo of DEMO_USERS) {
    const user = await prisma.user.create({
      data: { name: demo.name, email: demo.email, bio: demo.bio, passwordHash },
    });
    users[demo.key] = user.id;
  }

  const categories = new Map(
    (await prisma.category.findMany()).map((category) => [category.name, category.id]),
  );
  const fallbackCategoryId = [...categories.values()][0];
  if (fallbackCategoryId === undefined) throw new Error('No categories exist — cannot create demo posts');

  const postIds: number[] = [];
  for (const [index, post] of DEMO_POSTS.entries()) {
    const created = await prisma.post.create({
      data: {
        title: post.title,
        content: post.content,
        codeSnippet: post.codeSnippet ?? null,
        language: post.language ?? null,
        authorId: users[post.author],
        categoryId: categories.get(post.category) ?? fallbackCategoryId,
        // spread the dates so "newest" sorting is visible
        createdAt: new Date(Date.now() - (DEMO_POSTS.length - index) * 3_600_000),
      },
    });
    postIds.push(created.id);
  }

  const [p0, p1, p2, p3, p4, p5, p6] = postIds as [number, number, number, number, number, number, number];
  await prisma.like.createMany({
    data: [
      { userId: users.dan, postId: p0 },
      { userId: users.yael, postId: p0 },
      { userId: users.yael, postId: p1 },
      { userId: users.noa, postId: p3 },
      { userId: users.noa, postId: p4 },
      { userId: users.yael, postId: p4 },
      { userId: users.dan, postId: p6 },
    ],
  });
  await prisma.comment.createMany({
    data: [
      { postId: p0, authorId: users.dan, content: 'Great tip, I use ?? together with it all the time.' },
      { postId: p0, authorId: users.yael, content: 'Did not know this one, thanks!' },
      { postId: p2, authorId: users.dan, content: 'This confused me for a whole day once 😅' },
      { postId: p6, authorId: users.noa, content: 'COUNT(DISTINCT) saved me too.' },
    ],
  });
  await prisma.follow.createMany({
    data: [
      { followerId: users.noa, followingId: users.dan },
      { followerId: users.dan, followingId: users.noa },
      { followerId: users.yael, followingId: users.noa },
      { followerId: users.yael, followingId: users.dan },
    ],
  });
  await prisma.savedPost.createMany({
    data: [
      { userId: users.noa, postId: p5 },
      { userId: users.noa, postId: p6 },
      { userId: users.yael, postId: p1 },
    ],
  });
  console.log(`✔ Created ${DEMO_USERS.length} demo users, ${postIds.length} posts, likes, comments, follows and saves`);
}

async function main() {
  console.log(`Seeding database (${isProduction ? 'production' : 'development'} mode)...`);
  await ensureCategories();

  if (isProduction) {
    const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    if (adminEmail && adminPassword) {
      if (adminPassword.length < 8) throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters');
      await ensureAdmin(adminEmail, adminPassword, 'CodeNest Admin');
    } else {
      console.log('ℹ SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — no admin created');
    }

    const demoPassword = process.env.SEED_DEMO_PASSWORD;
    if (demoPassword) {
      if (demoPassword.length < 8) throw new Error('SEED_DEMO_PASSWORD must be at least 8 characters');
      await ensureDemoContent(demoPassword);
    } else {
      console.log('ℹ SEED_DEMO_PASSWORD not set — no demo users created');
    }
  } else {
    await ensureAdmin(DEV_ADMIN.email, DEV_ADMIN.password, 'CodeNest Admin');
    await ensureDemoContent(DEV_USER_PASSWORD);
    console.log('\nDemo logins (development only):');
    console.log(`  Admin: ${DEV_ADMIN.email} / ${DEV_ADMIN.password}`);
    for (const user of DEMO_USERS) console.log(`  User:  ${user.email} / ${DEV_USER_PASSWORD}`);
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
