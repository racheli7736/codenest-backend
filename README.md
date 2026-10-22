# CodeNest API 🪺

שרת Backend לרשת חברתית לשיתוף ידע בין מתכנתים: פוסטים עם קטעי קוד, תגובות, לייקים, מעקב אחרי משתמשים ושמירת פוסטים.

**טכנולוגיות:** Node.js 22 · Express 5 · TypeScript (strict) · PostgreSQL · Prisma 6 · Cloudflare R2 (S3 API) · Zod · JWT · bcrypt · Swagger (OpenAPI 3) · Vitest

📄 **קבצים חשובים:**
- [`START-HERE.md`](START-HERE.md): העלאה ל־GitHub, ל־Neon ול־Render, צעד אחר צעד
- [`FRONTEND-API-GUIDE.md`](FRONTEND-API-GUIDE.md): כל מה שצריך כדי לכתוב את צד ה־React
- [`docs/openapi.json`](docs/openapi.json): קובץ ה־OpenAPI (אפשר לפתוח ב־https://editor.swagger.io)
- [`docs/SPEC.md`](docs/SPEC.md): מסמך האפיון המאושר

---

## הרצה על המחשב שלך

### מה צריך להתקין
1. **Node.js 22 LTS** מ־https://nodejs.org
2. **מסד נתונים PostgreSQL**. יש שתי אפשרויות:
   - **א. Docker Desktop** (https://www.docker.com/products/docker-desktop). הפקודה `npm run db:up` מפעילה PostgreSQL מקומי שכבר מוגדר לפרויקט.
   - **ב. בלי Docker:** ליצור מסד נתונים חינמי ב־Neon (ראי `START-HERE.md`, חלק ב) ולהשתמש בכתובת שלו.

> 💡 **ב־Windows:** חלצי את הפרויקט לתיקייה עם נתיב קצר, למשל `C:\projects\codenest`. ל־Windows יש מגבלה של 260 תווים לנתיב קובץ, ובנתיבים ארוכים מאוד `npm install` עלול להיכשל בשגיאות מוזרות.

### שלבים
```bash
# 1. התקנת החבילות
npm install

# 2. יצירת קובץ הגדרות מקומי
cp .env.example .env        # ב־Windows: copy .env.example .env
#    ב־.env: לשנות את JWT_SECRET למחרוזת אקראית ארוכה.
#    אם משתמשים ב־Neon: להחליף את DATABASE_URL בכתובת מ־Neon.

# 3. הפעלת PostgreSQL מקומי (רק באפשרות Docker)
npm run db:up

# 4. יצירת הטבלאות
npm run db:deploy

# 5. נתוני הדגמה
npm run db:seed

# 6. הפעלת השרת (מתעדכן אוטומטית בכל שינוי בקוד)
npm run dev
```
עכשיו אפשר לפתוח:
- http://localhost:3000/api/health
- http://localhost:3000/api-docs (Swagger)

### משתמשי דמו (רק בפיתוח)
| תפקיד | אימייל | סיסמה |
|---|---|---|
| מנהל | `admin@codenest.dev` | `Admin1234!` |
| משתמש | `noa@codenest.dev` | `User1234!` |
| משתמש | `dan@codenest.dev` | `User1234!` |
| משתמש | `yael@codenest.dev` | `User1234!` |

> 🔒 בסביבת **Production** ה־Seed **לא** יוצר את הסיסמאות האלה. מנהל ומשתמשי דמו נוצרים רק לפי משתני הסביבה `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` ו־`SEED_DEMO_PASSWORD`, עם סיסמאות שאת בוחרת.

---

## פקודות

| פקודה | מה היא עושה |
|---|---|
| `npm run dev` | הרצה בפיתוח עם רענון אוטומטי |
| `npm run build` | `prisma generate` והידור TypeScript לתיקייה `dist/` |
| `npm start` | הרצת הגרסה המהודרת |
| `npm run render:start` | מה ש־Render מריץ: migrations, אחר כך seed, ואז start |
| `npm run typecheck` | בדיקת טיפוסים של TypeScript |
| `npm test` | כל הבדיקות האוטומטיות (צריך PostgreSQL פעיל) |
| `npm run db:up` / `db:down` | הפעלה או עצירה של PostgreSQL ב־Docker |
| `npm run db:migrate` | יצירת Migration חדשה אחרי שינוי ב־`schema.prisma` |
| `npm run db:deploy` | הרצת ה־Migrations הקיימות |
| `npm run db:seed` | נתוני הדגמה (אפשר להריץ כמה פעמים, בלי כפילויות) |
| `npm run db:reset` | ⚠️ מוחק הכול, יוצר מחדש ומריץ Seed |
| `npm run db:studio` | ממשק גרפי לצפייה בטבלאות |
| `npm run docs:export` | עדכון `docs/openapi.json` |
| `npm run images:migrate-to-r2 -- [--dry-run]` | העברת תמונות ישנות מהמסד ל־R2, עם אימות (ראי `docs/R2-MIGRATION.md`) |
| `npm run images:verify` / `images:backup` / `images:purge-db-data` / `images:cleanup-orphans` | כלי תחזוקה לאחסון התמונות |

---

## בדיקות

הבדיקות רצות מול **PostgreSQL אמיתי**, במסד נתונים נפרד בשם `codenest_test`. כך הנתונים שלך לא נפגעים.
עם `npm run db:up` המסד הזה נוצר אוטומטית. מסד נתונים אחר אפשר להגדיר במשתנה `TEST_DATABASE_URL` (השם שלו חייב לכלול את המילה `test`, כהגנה).

```bash
npm run db:up
npm test
```

הבדיקות מכסות: הרשמה והתחברות, Token חסר, שגוי, מזויף ופג תוקף, הרשאות USER/ADMIN, CRUD של פוסטים, ולידציה, חיפוש, סינון, מיון ועמודים, לייקים, שמירות, תגובות, מעקב, פרטיות (אימייל ושמורים), העלאת תמונות, תקינות Swagger ותקינות Prisma Migrations.

---

## מבנה הפרויקט

```
backend-project/
├── prisma/
│   ├── schema.prisma          # הגדרת הטבלאות
│   ├── migrations/            # קובצי SQL שיוצרים את הטבלאות
│   └── seed.ts                # נתוני הדגמה
├── src/
│   ├── server.ts              # נקודת הכניסה, מפעילה את השרת
│   ├── app.ts                 # הגדרת Express, CORS, Swagger ונתיבים
│   ├── config/env.ts          # קריאה ובדיקה של משתני הסביבה
│   ├── lib/prisma.ts          # החיבור למסד הנתונים
│   ├── docs/openapi.ts        # תיעוד Swagger
│   ├── middleware/            # authenticate, requireRole, upload, errorHandler, rateLimit
│   ├── utils/                 # JWT, סיסמאות, שגיאות, עמודים
│   └── modules/
│       ├── auth/              # כל מודול: routes → controller → service + schemas
│       ├── users/
│       ├── posts/
│       ├── comments/
│       ├── categories/
│       ├── images/
│       └── health/
├── tests/                     # בדיקות Vitest + Supertest
├── docs/                      # openapi.json, SPEC.md
├── render.yaml                # הגדרות פריסה ל־Render
├── docker-compose.yml         # PostgreSQL מקומי (רשות)
└── .env.example               # דוגמה למשתני סביבה
```

**איך בקשה עוברת בשרת:**
`Route` (איזו כתובת) → `Middleware` (Token והרשאות) → `Controller` (קריאת הבקשה ובדיקתה עם Zod) → `Service` (הלוגיקה ומסד הנתונים) → תשובת JSON.
כל שגיאה מגיעה ל־`errorHandler`, שמחזיר אותה במבנה אחיד.

---

## אבטחה
- הסיסמאות נשמרות כ־**bcrypt hash** ולא מוחזרות אף פעם.
- **JWT** עם תוקף מוגבל (`JWT_EXPIRES_IN`) וסוד ממשתנה סביבה.
- המשתמש מזוהה **רק לפי ה־Token**. התפקיד נטען מחדש ממסד הנתונים בכל בקשה.
- בדיקת בעלות בצד השרת: עריכה ומחיקה רק של תוכן שלי (מנהל יכול למחוק הכול).
- הגבלת ניסיונות התחברות (20 ב־15 דקות לכל כתובת IP).
- בדיקה שקובץ שהועלה הוא באמת תמונה (לפי תוכן הקובץ, ולא לפי הסיומת).
- Helmet, CORS שניתן להגדיר, הגבלת גודל לבקשות.
- אילוצי CHECK במסד הנתונים (למשל: אי אפשר לעקוב אחרי עצמך).

## איפה נשמרות התמונות
קובצי התמונות נשמרים ב־**Cloudflare R2** (אחסון אובייקטים תואם S3, ב־Bucket פרטי). ב־PostgreSQL נשמרים רק מפתח הקובץ (`storage_key`), הסוג, הגודל והקשרים לפוסטים ולמשתמשים.
`GET /api/images/:id` שולף את הקובץ מ־R2 ושולח אותו ישירות. כך כתובת התמונה **קבועה** וניתנת לשמירה במטמון. אפשר לעבור להפניה (302) לכתובת חתומה וזמנית עם `IMAGE_DELIVERY=redirect`. ההגבלה היא 2MB לתמונה, בפורמטים JPG, PNG או WEBP.
- הגדרות: משתני `R2_*` (ראי `.env.example`). בלי הגדרות R2, העלאות מחזירות 503 ושאר המערכת עובדת.
- בהרצה מקומית בלי R2 אפשר להגדיר `STORAGE_DRIVER=memory` (התמונות נמחקות בכל הפעלה מחדש).
- העברת תמונות ישנות מהמסד, גיבוי ואימות: [`docs/R2-MIGRATION.md`](docs/R2-MIGRATION.md).
