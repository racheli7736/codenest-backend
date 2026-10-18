# 🚀 מתחילים כאן: העלאת שרת CodeNest לאינטרנט

המדריך הזה מיועד למי שמעולם לא העלתה שרת לאינטרנט. עברי עליו לפי הסדר, שלב אחרי שלב.

**מה נעשה?**
1. **GitHub:** נשמור את הקוד באינטרנט.
2. **Neon:** ניצור מסד נתונים PostgreSQL חינמי בענן.
3. **Render:** נריץ את השרת בענן. Render לוקח את הקוד מ־GitHub ומתחבר ל־Neon.
4. **בדיקה:** נוודא שהכול עובד דרך Swagger.

> ⚠️ **הערה חשובה על המסכים:** ממשקי האתרים (GitHub, Neon ו־Render) משתנים מדי פעם. כתבתי את שמות הכפתורים לפי מה שהיה מוכר לי בזמן הכתיבה, אבל **לא יכולתי לבדוק את המסכים העדכניים בעצמי**. אם כפתור נקרא קצת אחרת, חפשי משהו דומה בשם. העיקר הוא הערכים שצריך להכניס, והם מדויקים.

> 💰 **על "חינמי":** המסלולים החינמיים קיימים נכון ל־2026, אבל יש להם מגבלות. בשרת החינמי של Render, **השרת "נרדם" אחרי 15 דקות בלי שימוש**, והבקשה הראשונה אחרי זה לוקחת בערך דקה. זה תקין לפרויקט גמר. ב־Neon יש מגבלת נפח קטנה (בערך 0.5–1GB), וזה מספיק בהחלט לפרויקט כזה. בכל מקרה, **לא צריך להכניס כרטיס אשראי.** אם אתר מבקש כרטיס אשראי, עצרי ובדקי שבחרת במסלול Free.

---

## חלק א: GitHub (שמירת הקוד)

### 1. פתיחת חשבון
1. היכנסי ל־https://github.com
2. לחצי **Sign up**.
3. הכניסי אימייל, סיסמה ושם משתמש, ואשרי את האימייל.

### 2. יצירת Repository (מאגר קוד)
1. אחרי ההתחברות, לחצי על **+** בפינה העליונה ואז **New repository**.
2. **Repository name:** `codenest-backend`
3. בחרי **Private** (מומלץ) או **Public**. Render עובד עם שניהם.
4. **אל תסמני** "Add a README file", כי כבר יש לנו README.
5. לחצי **Create repository**.

### 3. חילוץ קובץ ה־ZIP
1. במחשב, לחצי לחיצה ימנית על קובץ ה־ZIP ובחרי **Extract All** (חלץ הכול).
2. תיפתח תיקייה בשם `backend-project`, ובתוכה הקבצים `package.json`, `README.md`, התיקייה `src` ועוד.

### 4. העלאת הקבצים דרך הדפדפן
1. בדף ה־Repository החדש, לחצי על הקישור **uploading an existing file**. (אם כבר יש קבצים: **Add file** ואז **Upload files**.)
2. פתחי את התיקייה `backend-project` במחשב, **סמני את כל מה שבתוכה** (Ctrl+A) וגררי לחלון הדפדפן.
   - ⚠️ חשוב לגרור את **התוכן** של התיקייה, ולא את התיקייה עצמה. כך `package.json` יהיה בשורש המאגר.
3. חכי שכל הקבצים יסיימו לעלות.
4. למטה, בתיבה **Commit changes**, לחצי על הכפתור הירוק **Commit changes**.

### 5. בדיקה שהקבצים ב־GitHub
בדף הראשי של ה־Repository צריכים להופיע, **ישירות בדף הראשי**:
`package.json`, `package-lock.json`, `render.yaml`, `tsconfig.json`, `.env.example`, `.gitignore`, ואת התיקיות `src`, `prisma`, `tests`, `docs`.

✅ ודאי שיש תיקייה `prisma/migrations`. בלעדיה מסד הנתונים לא ייווצר.
❌ אין להעלות קובץ בשם `.env` (בלי `.example`). הוא לא נמצא ב־ZIP, וטוב שכך.

---

## חלק ב: מסד נתונים PostgreSQL חינמי (Neon)

> למה לא מסד הנתונים של Render? כי מסד הנתונים החינמי של Render **נמחק אחרי 30 יום**. ב־Neon מסד הנתונים החינמי לא פג.
> חלופה: Supabase (הסבר בסוף החלק).

### 1. פתיחת חשבון
1. היכנסי ל־https://neon.com
2. לחצי **Sign up**. הכי פשוט להירשם עם חשבון GitHub או Google.

### 2. יצירת מסד נתונים
1. לחצי **Create project** (או **New Project**).
2. **Project name:** `codenest`
3. **Postgres version:** השאירי את ברירת המחדל.
4. **Region:** בחרי אזור קרוב לאזור שתבחרי ב־Render. **Europe (Frankfurt)** מתאים לשניהם.
5. לחצי **Create project**.

### 3. קבלת ה־Connection String (כתובת החיבור)
1. בדף הפרויקט לחצי **Connect** (או חפשי "Connection string").
2. אם יש מתג **Connection pooling**, **כבי אותו**. אנחנו צריכים חיבור ישיר.
3. העתיקי את הכתובת. היא נראית בערך כך:
   ```
   postgresql://neondb_owner:AbC123xyz@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
   - אם בסוף הכתובת אין `?sslmode=require`, הוסיפי את זה.

### 4. שמירה בטוחה
- 🔒 הכתובת הזאת **כוללת סיסמה**. מי שיש לו אותה יכול לקרוא ולמחוק את כל הנתונים.
- שמרי אותה במקום פרטי, למשל במנהל סיסמאות או בקובץ במחשב שלך שלא עולה ל־GitHub.
- **לעולם אל** תכתבי אותה בקוד, ב־README או ב־GitHub.

### 5. קישור השרת למסד הנתונים
את הכתובת הזאת תדביקי ב־Render, במשתנה בשם `DATABASE_URL` (שלב 6 בחלק ג). זה כל הקישור.
בהפעלה הראשונה השרת יוצר בעצמו את כל הטבלאות (Prisma Migrations).

#### חלופה: Supabase
1. https://supabase.com, ואז **New project**. בחרי סיסמה למסד הנתונים ושמרי אותה.
2. בדף הפרויקט לחצי **Connect**.
3. העתיקי את הכתובת מתוך **Session pooler** (ולא Direct connection, כי חיבור ישיר לא תמיד עובד מ־Render).
4. החליפי את `[YOUR-PASSWORD]` בסיסמה שבחרת.

---

## חלק ג: Render (הרצת השרת)

### 1. פתיחת חשבון
1. היכנסי ל־https://render.com
2. לחצי **Get Started** והירשמי **עם GitHub**. זה הכי פשוט, כי החיבור ל־GitHub נעשה אוטומטית.

### 2. חיבור GitHub
אם נרשמת עם GitHub, החיבור כבר קיים. אם Render מבקש גישה למאגרים, אשרי גישה ל־`codenest-backend` (או לכל המאגרים).

### 3. יצירת Web Service
1. בלוח הבקרה לחצי **+ New** ואז **Web Service**.

### 4. בחירת ה־Repository
1. בחרי את `codenest-backend` ברשימה ולחצי **Connect**.

### 5. הגדרות Build ו־Start
מלאי **בדיוק** כך:

| שדה | ערך |
|---|---|
| **Name** | `codenest-api` (הוא יופיע בכתובת האתר) |
| **Language / Runtime** | `Node` |
| **Branch** | `main` |
| **Region** | `Frankfurt (EU Central)` |
| **Root Directory** | השאירי **ריק** |
| **Build Command** | `npm ci --include=dev && npm run build` |
| **Start Command** | `npm run render:start` |
| **Instance Type** | **Free** |

> מה עושה `render:start`? (1) מריץ Prisma Migrations שיוצרות או מעדכנות טבלאות, (2) מריץ Seed בטוח, (3) מפעיל את השרת.

### 6. משתני סביבה (Environment Variables)
גללי ל־**Environment Variables** ולחצי **Add Environment Variable** עבור כל שורה:

| Key (שם) | Value (ערך) | הסבר |
|---|---|---|
| `NODE_ENV` | `production` | מצב ייצור |
| `NODE_VERSION` | `22` | גרסת Node |
| `DATABASE_URL` | הכתובת מ־Neon | חובה |
| `JWT_SECRET` | מחרוזת אקראית ארוכה (ראי למטה) | חובה, 32 תווים לפחות |
| `JWT_EXPIRES_IN` | `24h` | תוקף ההתחברות |
| `CORS_ORIGIN` | `*` | בינתיים כל אתר. אחר כך כתובת אתר ה־React |
| `SEED_ADMIN_EMAIL` | האימייל שלך, למשל `admin@codenest.app` | חשבון המנהל |
| `SEED_ADMIN_PASSWORD` | סיסמה **שרק את יודעת** (8 תווים לפחות) | סיסמת המנהל |
| `SEED_DEMO_PASSWORD` | (רשות) סיסמה לחשבונות הדמו | יוצר משתמשי דמו ופוסטים לדוגמה |

**איך מקבלים JWT_SECRET?**
- דרך פשוטה: ליד השדה יש ב־Render כפתור **Generate**. לחצי עליו.
- או, אם Node מותקן אצלך, הריצי במחשב:
  ```
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

> 💡 אם הגדרת `SEED_DEMO_PASSWORD`, ייווצרו המשתמשים `noa@codenest.dev`, `dan@codenest.dev` ו־`yael@codenest.dev` עם הסיסמה שבחרת, ועוד 8 פוסטים לדוגמה. זה נוח להצגת הפרויקט.

### 7. Health Check (בדיקת בריאות)
אם יש אזור **Advanced**, פתחי אותו ובשדה **Health Check Path** כתבי:
```
/api/health
```

### 8. Prisma Migrations
אין צורך לעשות שום דבר! הן רצות אוטומטית בכל הפעלה, כחלק מ־`npm run render:start`.

### 9. Deploy
1. לחצי **Deploy Web Service** (או **Create Web Service**).
2. ייפתח מסך **Logs**. חכי כמה דקות. בסוף צריך להופיע:
   ```
   All migrations have been successfully applied.
   ✔ Created 5 categories
   ✔ Created admin ...
   CodeNest API running on port 10000 (production)
   ```
3. למעלה יופיע הסטטוס **Live** 🟢.

### 10. בדיקה שהשרת פעיל
למעלה בדף השירות מופיעה הכתובת שלך, למשל:
```
https://codenest-api.onrender.com
```
פתחי בדפדפן:
```
https://codenest-api.onrender.com/api/health
```
אמור להופיע: `{"status":"ok","database":"connected",...}` 🎉

### דרך חלופית: Blueprint (אוטומטית)
בפרויקט יש קובץ `render.yaml`, שמגדיר את כל ההגדרות שבשלבים 5–7 מראש:
**+ New**, אחר כך **Blueprint**, בחירת המאגר ואז **Apply**. Render ייצור לבד את `JWT_SECRET` ויבקש ממך רק את `DATABASE_URL` ואת פרטי המנהל.

---

## חלק ד: בדיקה מלאה

(בדוגמאות אני משתמשת בכתובת `https://codenest-api.onrender.com`. החליפי בכתובת שלך.)

### 1. פתיחת `/api/health`
`https://codenest-api.onrender.com/api/health`. צריך להופיע `"status":"ok"`.
> אם זה איטי, השרת "התעורר" משינה. חכי עד דקה ורענני.

### 2. פתיחת `/api-docs`
`https://codenest-api.onrender.com/api-docs`. תיפתח רשימה של כל ה־Endpoints (Swagger).

### 3. התחברות מתוך Swagger
1. מצאי **POST /api/auth/login** ולחצי עליו.
2. לחצי **Try it out**.
3. בתיבת ה־Request body כתבי את פרטי המנהל שהגדרת:
   ```json
   { "email": "admin@codenest.app", "password": "הסיסמה-שבחרת" }
   ```
4. לחצי **Execute**.

### 4. קבלת JWT
בתשובה (Response body, קוד 200) יופיע:
```json
{ "token": "eyJhbGciOiJIUzI1NiIs...", "user": { ... "role": "ADMIN" } }
```
העתיקי את הערך של `token` **בלי המירכאות**.

### 5. שימוש ב־Authorize
1. גללי לראש הדף ולחצי על הכפתור הירוק **Authorize** 🔓.
2. הדביקי את ה־Token בשדה **Value**. **אל תכתבי** את המילה Bearer, Swagger מוסיף אותה לבד.
3. לחצי **Authorize** ואז **Close**. המנעולים יהיו עכשיו סגורים 🔒.

### 6. קריאה ל־Endpoint מוגן
פתחי **GET /api/auth/me**, לחצי **Try it out** ואז **Execute**. אמור לחזור קוד 200 עם הפרטים שלך.
> 🧪 בדיקת אבטחה: לחצי **Authorize**, אחר כך **Logout**, ונסי שוב. יחזור קוד **401**.
> 🧪 בדיקת הרשאות: הירשמי כמשתמש רגיל (POST /api/auth/register), עשי Authorize עם ה־Token החדש ונסי **GET /api/users**. יחזור קוד **403**.

### 7. הוספת רשומה
1. **GET /api/categories**, ואז **Execute**. רשמי את ה־`id` של קטגוריה, למשל 1.
2. **POST /api/posts**, אחר כך **Try it out**, ואז:
   ```json
   {
     "title": "הפוסט הראשון שלי",
     "content": "בדיקה שהשרת שומר נתונים",
     "codeSnippet": "console.log('Hello CodeNest');",
     "language": "JAVASCRIPT",
     "categoryId": 1
   }
   ```
3. **Execute**. אמור לחזור קוד **201** עם הפוסט ו־`id` חדש.

### 8. שליפת הרשומה ממסד הנתונים
1. **GET /api/posts**, אחר כך **Try it out**. בשדה `search` כתבי `הראשון`, ואז **Execute**.
2. הפוסט שלך מופיע ברשימה. ✅ הוא נשמר באמת ב־PostgreSQL.
3. רוצה לראות את הטבלה עצמה? ב־Neon, בתפריט **Tables**, בחרי `posts`.

---

## חלק ה: פתרון תקלות

| תקלה | מה רואים | פתרון |
|---|---|---|
| **Build Failed** | ב־Logs: `npm ERR!` או `tsc` error | ודאי ש־Build Command הוא בדיוק `npm ci --include=dev && npm run build`. ודאי ש־`package.json` ו־`package-lock.json` נמצאים בשורש המאגר, ולא בתוך תיקייה. אם הם בתוך תיקייה, כתבי את שמה ב־**Root Directory**. |
| **DATABASE_URL שגוי** | `Can't reach database server` / `P1001` / `P1000 Authentication failed` | העתיקי שוב את הכתובת מ־Neon. ודאי שהיא מתחילה ב־`postgresql://` ומסתיימת ב־`?sslmode=require`, ושאין רווחים או מירכאות מיותרות. ב־Supabase: ודאי שהחלפת את `[YOUR-PASSWORD]`. |
| **בעיית Prisma** | `P3009 migrate found failed migrations` או `relation "users" does not exist` | ודאי שהתיקייה `prisma/migrations` עלתה ל־GitHub. אם מסד הנתונים חדש וריק ונכשל באמצע, מחקי את ה־Database ב־Neon, צרי חדש ועדכני את `DATABASE_URL`. |
| **Prisma עם Pooler** | `prepared statement already exists` | ב־Neon: כבי את **Connection pooling** והעתיקי שוב. ב־Supabase: השתמשי ב־**Session** pooler (פורט 5432) ולא ב־Transaction. |
| **JWT_SECRET חסר** | `Invalid environment variables: JWT_SECRET ...` | הוסיפי את `JWT_SECRET` ב־**Environment**. חייבים 32 תווים לפחות. |
| **שגיאת CORS** | בדפדפן (Console): `blocked by CORS policy` | ב־Render עדכני את `CORS_ORIGIN` לכתובת אתר ה־React **בדיוק**, בלי `/` בסוף. למשל `https://my-app.vercel.app`. אפשר כמה כתובות עם פסיק: `https://my-app.vercel.app,http://localhost:5173`. אחר כך **Save** ו־Deploy מחדש. |
| **401 Unauthorized** | `TOKEN_MISSING` / `TOKEN_INVALID` / `TOKEN_EXPIRED` | התחברי שוב וקבלי Token חדש (הוא תקף 24 שעות). ב־Swagger: Authorize בלי המילה Bearer. ב־React: הכותרת צריכה להיות `Authorization: Bearer <token>`. אחרי שינוי `JWT_SECRET` כל ה־Tokens הישנים מפסיקים לעבוד, וזה תקין. |
| **403 Forbidden** | `FORBIDDEN` | את מחוברת, אבל אין לך הרשאה. למשל: משתמש רגיל שמנסה לנהל קטגוריות, או עריכה של פוסט של מישהו אחר. התחברי עם המשתמש המתאים. |
| **Swagger לא נפתח** | דף ריק או 404 | ודאי שהכתובת היא `/api-docs` (עם מקף). חכי שהשרת "יתעורר". בדקי ב־Logs שהשרת עלה. |
| **השרת לא עולה** | סטטוס **Failed**, או שהדף נטען לנצח | פתחי **Logs** וחפשי את השורה האדומה הראשונה. הסיבות הנפוצות: משתנה סביבה חסר, `DATABASE_URL` שגוי, או `Start Command` לא נכון. ודאי שה־Start Command הוא `npm run render:start`. |
| **`npm install` נכשל במחשב שלך (Windows)** | שגיאות כמו `ERR_PACKAGE_IMPORT_NOT_DEFINED` או `ENOENT` | העבירי את הפרויקט לנתיב קצר, למשל `C:\projects\codenest`, מחקי את `node_modules` והריצי שוב `npm install`. ל־Windows יש מגבלה של 260 תווים לנתיב. (זה לא משפיע על Render.) |
| **הבקשה הראשונה איטית מאוד** | חצי דקה עד דקה | זה תקין במסלול החינמי. השרת נרדם אחרי 15 דקות בלי שימוש. |
| **שכחתי את סיסמת המנהל** | 401 בהתחברות | שינוי `SEED_ADMIN_PASSWORD` **לא** משנה סיסמה קיימת (מטעמי אבטחה). הגדירי `SEED_ADMIN_EMAIL` חדש עם סיסמה חדשה ועשי Deploy מחדש. ייווצר מנהל נוסף. |

## חלק ו: אחסון תמונות ב־Cloudflare R2

קובצי התמונות נשמרים ב־**Cloudflare R2**. ב־Neon נשמרת רק ההפניה לקובץ. בלי ההגדרות האלה השרת עובד, אבל העלאת תמונות מחזירה 503.

> ⚠️ לא יכולתי לבדוק את המסכים העדכניים של Cloudflare, אז ייתכן ששמות הכפתורים קצת שונים.
> 💰 ל־R2 יש מסלול חינמי (לפי Cloudflare: 10GB אחסון בחודש, ובלי תשלום על הורדות). **ייתכן ש־Cloudflare יבקשו להוסיף אמצעי תשלום כדי להפעיל את R2**, גם כשהשימוש נשאר בתוך המסלול החינמי. בדקי את התנאים לפני שאת מאשרת.

### 1. פתיחת חשבון והפעלת R2
1. היכנסי ל־https://dash.cloudflare.com ולחצי **Sign up**.
2. בתפריט הצד בחרי **R2 Object Storage**, ופעלי לפי ההוראות להפעלת השירות.

### 2. יצירת Bucket
1. **Create bucket**.
2. **Bucket name:** `codenest-images`
3. **Location:** Automatic (או אירופה).
4. **אל** תפעילי גישה ציבורית (Public access). ה־Bucket נשאר **פרטי**, והשרת יוצר כתובות זמניות.

### 3. יצירת מפתחות גישה (API Token)
1. בעמוד R2 לחצי **Manage API tokens** (או **API**), ואז **Create API token**.
2. **Permissions:** `Object Read & Write`.
3. **Specify bucket:** רק `codenest-images`.
4. לחצי **Create**. יוצגו לך:
   - **Access Key ID**
   - **Secret Access Key**: מוצג **פעם אחת בלבד**! העתיקי ושמרי במקום בטוח.
   - **Account ID**: מופיע גם בכתובת ה־endpoint, `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
5. 🔒 אל תשלחי את המפתחות בצ'אט ואל תכתבי אותם בקוד.

### 4. הגדרה ב־Render
ב־Render ← השירות `codenest-api` ← **Environment** ← **Add Environment Variable**:

| Key | Value |
|---|---|
| `STORAGE_DRIVER` | `r2` |
| `R2_ACCOUNT_ID` | ה־Account ID |
| `R2_ACCESS_KEY_ID` | ה־Access Key ID |
| `R2_SECRET_ACCESS_KEY` | ה־Secret Access Key |
| `R2_BUCKET` | `codenest-images` |

לחצי **Save Changes**. Render יפעיל את השרת מחדש.

### 5. בדיקה
- `https://<השרת-שלך>.onrender.com/api/health` צריך להציג `"storage": "r2"`.
- ב־Swagger: Authorize, ואז **PUT /api/users/me/avatar**, העלאת תמונה, ופתיחת ה־`avatarUrl` שחזר בלשונית חדשה.
- ב־Cloudflare, ב־Bucket, יופיע קובץ חדש בתיקייה `images/`.

### 6. העברת תמונות ישנות (אם יש)
ההוראות המלאות, כולל גיבוי לפני הכול, נמצאות ב־[`docs/R2-MIGRATION.md`](docs/R2-MIGRATION.md).

### תקלות נפוצות ב־R2
| תקלה | פתרון |
|---|---|
| `"storage": "not_configured"` ב־health | חסר אחד ממשתני `R2_*` ב־Render, או שיש בו רווח מיותר |
| העלאה מחזירה **502 STORAGE_ERROR** | מפתח שגוי, Token בלי הרשאת Write, או שם Bucket שגוי. בדקי ב־Render ← Logs את השורה `[storage] upload failed` |
| התמונה לא נפתחת (403 מ־R2) | הכתובת הזמנית פגה (אחרי `IMAGE_URL_TTL_SECONDS`). רענני את הדף, והשרת ייתן כתובת חדשה |
| במחשב שלך התמונות לא נטענות | ייתכן שסינון האינטרנט (נטפרי) חוסם את `*.r2.cloudflarestorage.com`. בקשי פתיחה |

---

### מה הלאה?
- המדריך לבניית צד ה־React נמצא בקובץ **`FRONTEND-API-GUIDE.md`**.
- הוראות להרצת השרת על המחשב שלך נמצאות בקובץ **`README.md`**.
