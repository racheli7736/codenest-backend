# 📗 מדריך API לפיתוח צד ה־React של CodeNest

המסמך מסביר **מה** לשלוח לשרת ו**מה** חוזר ממנו, כדי שתוכלי לכתוב את כל צד ה־React בעצמך.
אין כאן קוד React. יש רק בקשות HTTP ודוגמאות JSON.

> 💡 את כל ה־Endpoints אפשר לנסות בלחיצה ב־Swagger: `<BASE_URL>/api-docs`

---

## 1. כתובת ה־Base URL

| סביבה | Base URL |
|---|---|
| מחשב מקומי | `http://localhost:3000` |
| ענן (Render) | `https://codenest-api.onrender.com` (או השם שבחרת) |

💡 מומלץ לשמור את הכתובת במשתנה סביבה של פרויקט ה־React (ב־Vite: קובץ `.env` עם `VITE_API_URL=...`), ולא לכתוב אותה בתוך הקוד.

כל הכתובות במסמך יחסיות. למשל `/api/posts` פירושו `<BASE_URL>/api/posts`.

---

## 2. Authentication: איך עובדת ההתחברות

1. המשתמש נרשם (`POST /api/auth/register`) או מתחבר (`POST /api/auth/login`).
2. השרת מחזיר **`token`** (JWT) ואת פרטי המשתמש (**`user`**).
3. שומרים את ה־token בצד הלקוח, למשל ב־`localStorage`.
4. **בכל בקשה** לשרת, כשיש token שמור, שולחים כותרת:
   ```
   Authorization: Bearer <token>
   ```
   יש רווח אחד בין `Bearer` ל־token.
5. ה־token תקף **24 שעות**. אחרי זה השרת מחזיר `401` עם `"code": "TOKEN_EXPIRED"`, וצריך להעביר את המשתמש למסך ההתחברות.
6. **התנתקות** = מחיקת ה־token בצד הלקוח. אין Endpoint להתנתקות.
7. בטעינת האפליקציה, אם יש token שמור, קראי ל־`GET /api/auth/me` כדי לוודא שהוא עדיין תקף ולקבל את פרטי המשתמש.
8. כדי לדעת אם להציג מסכי מנהל, בדקי את `user.role === "ADMIN"`.
   ⚠️ זה רק לתצוגה. השרת בודק את ההרשאות בעצמו בכל מקרה.

### דוגמה: בקשת התחברות
```http
POST /api/auth/login
Content-Type: application/json

{ "email": "noa@codenest.dev", "password": "User1234!" }
```
תשובה `200`:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "name": "Noa Cohen",
    "email": "noa@codenest.dev",
    "bio": "Frontend developer who loves TypeScript",
    "role": "USER",
    "avatarUrl": null,
    "createdAt": "2026-10-01T09:00:00.000Z"
  }
}
```

### משתמשי דמו (בהרצה מקומית)
| תפקיד | אימייל | סיסמה |
|---|---|---|
| מנהל | `admin@codenest.dev` | `Admin1234!` |
| משתמש | `noa@codenest.dev` | `User1234!` |
| משתמש | `dan@codenest.dev` | `User1234!` |
| משתמש | `yael@codenest.dev` | `User1234!` |

בענן, הסיסמאות הן מה שהגדרת ב־Render (`SEED_ADMIN_PASSWORD`, `SEED_DEMO_PASSWORD`).

---

## 3. מבני הנתונים (Types)

### CurrentUser: המשתמש המחובר
| שדה | טיפוס | הערה |
|---|---|---|
| `id` | number | |
| `name` | string | |
| `email` | string | |
| `bio` | string \| null | |
| `role` | `"USER"` \| `"ADMIN"` | |
| `avatarUrl` | string \| null | כתובת יחסית (ראי סעיף 6) |
| `createdAt` | string (ISO date) | |

### UserSummary: משתמש קצר (ליד פוסט או תגובה)
`{ id: number, name: string, avatarUrl: string | null }`

### ListedUser: ברשימות עוקבים ונעקבים
`{ id, name, avatarUrl, bio }`

### UserProfile: פרופיל
| שדה | טיפוס | הערה |
|---|---|---|
| `id`, `name`, `bio`, `role`, `avatarUrl`, `createdAt` | | כמו למעלה |
| `email` | string \| null | **null** אם זה לא הפרופיל שלי ואני לא מנהל |
| `postsCount` | number | |
| `followersCount` | number | כמה עוקבים אחריו |
| `followingCount` | number | אחרי כמה הוא עוקב |
| `isFollowedByMe` | boolean | לכפתור "עקוב" / "הפסק לעקוב" |
| `isMe` | boolean | true = הפרופיל שלי, אז מציגים "ערוך פרופיל" במקום "עקוב" |

### Post: פוסט
| שדה | טיפוס | הערה |
|---|---|---|
| `id` | number | |
| `title` | string | |
| `content` | string | |
| `codeSnippet` | string \| null | שימי לב לשמור על רווחים ושורות בתצוגה |
| `language` | Language \| null | ראי רשימה למטה |
| `imageUrl` | string \| null | |
| `category` | `{ id, name }` | |
| `author` | UserSummary | |
| `likesCount` | number | |
| `commentsCount` | number | |
| `likedByMe` | boolean | לצביעת כפתור הלייק |
| `savedByMe` | boolean | לצביעת כפתור השמירה |
| `createdAt`, `updatedAt` | string (ISO date) | |

### Language: ערכים אפשריים
`JAVASCRIPT`, `TYPESCRIPT`, `PYTHON`, `JAVA`, `CSHARP`, `CPP`, `C`, `PHP`, `GO`, `RUST`, `KOTLIN`, `SWIFT`, `SQL`, `HTML_CSS`, `OTHER`

הצעה לתצוגה: `CSHARP` → "C#", `CPP` → "C++", `HTML_CSS` → "HTML/CSS".

### Comment: תגובה
`{ id, content, postId, author: UserSummary, createdAt }`

### Category: קטגוריה
`{ id, name, description: string | null, postsCount, createdAt }`

### Page: תשובה עם עמודים (לכל הרשימות)
```json
{ "items": [ ... ], "page": 1, "limit": 10, "total": 23, "totalPages": 3 }
```
- הבא: `page + 1` כל עוד `page < totalPages`.
- `?page=` ו־`?limit=` (מקסימום 50) עובדים בכל רשימה.

---

## 4. כל ה־Endpoints

🔓 = בלי token · 🔑 = כל משתמש מחובר · 👑 = מנהל בלבד

### אימות
| Method | URL | הרשאה | Body | הצלחה |
|---|---|:-:|---|---|
| GET | `/api/health` | 🔓 | – | `200 { status, database, timestamp }` |
| POST | `/api/auth/register` | 🔓 | `{ name, email, password }` | `201 { token, user }` |
| POST | `/api/auth/login` | 🔓 | `{ email, password }` | `200 { token, user }` |
| GET | `/api/auth/me` | 🔑 | – | `200 { user }` |

### האזור האישי שלי
| Method | URL | הרשאה | Body | הצלחה |
|---|---|:-:|---|---|
| GET | `/api/users/me/dashboard` | 🔑 | – | `200 { user, stats }` |
| PATCH | `/api/users/me` | 🔑 | `{ name?, bio? }` | `200 { user }` |
| PUT | `/api/users/me/avatar` | 🔑 | FormData: `image` | `200 { user }` |
| DELETE | `/api/users/me/avatar` | 🔑 | – | `204` (בלי גוף) |
| GET | `/api/users/me/saved-posts` | 🔑 | `?page&limit` | `200 Page<Post>` |

### משתמשים ומעקב
| Method | URL | הרשאה | הצלחה |
|---|---|:-:|---|
| GET | `/api/users?search=&page=&limit=` | 👑 | `200 Page<CurrentUser + postsCount>` |
| GET | `/api/users/:id` | 🔓 | `200 { user: UserProfile }` |
| GET | `/api/users/:id/followers` | 🔓 | `200 Page<ListedUser>` |
| GET | `/api/users/:id/following` | 🔓 | `200 Page<ListedUser>` |
| POST | `/api/users/:id/follow` | 🔑 | `204` |
| DELETE | `/api/users/:id/follow` | 🔑 | `204` |

### פוסטים
| Method | URL | הרשאה | Body | הצלחה |
|---|---|:-:|---|---|
| GET | `/api/posts` | 🔓 | פרמטרים, ראי למטה | `200 Page<Post>` |
| GET | `/api/posts/:id` | 🔓 | – | `200 { post }` |
| POST | `/api/posts` | 🔑 | `{ title, content, codeSnippet?, language?, categoryId }` | `201 { post }` |
| PATCH | `/api/posts/:id` | 🔑 רק הכותב/ת | שדות לעדכון | `200 { post }` |
| DELETE | `/api/posts/:id` | 🔑 כותב/ת או 👑 | – | `204` |
| PUT | `/api/posts/:id/image` | 🔑 רק הכותב/ת | FormData: `image` | `200 { post }` |
| DELETE | `/api/posts/:id/image` | 🔑 רק הכותב/ת | – | `204` |
| POST | `/api/posts/:id/like` | 🔑 | – | `200 { likesCount, likedByMe: true }` |
| DELETE | `/api/posts/:id/like` | 🔑 | – | `200 { likesCount, likedByMe: false }` |
| POST | `/api/posts/:id/save` | 🔑 | – | `200 { savedByMe: true }` |
| DELETE | `/api/posts/:id/save` | 🔑 | – | `200 { savedByMe: false }` |

**פרמטרים של `GET /api/posts`** (אפשר לשלב ביניהם):
| פרמטר | ערכים | משמעות |
|---|---|---|
| `search` | טקסט | חיפוש בכותרת ובתוכן, בלי הבדל בין אותיות גדולות לקטנות |
| `categoryId` | מספר | סינון לפי קטגוריה |
| `language` | Language | סינון לפי שפה |
| `authorId` | מספר | פוסטים של משתמש אחד (פרופיל או "הפוסטים שלי") |
| `feed` | `all` (ברירת מחדל) / `following` | `following` = רק ממי שאני עוקב/ת אחריו |
| `sort` | `newest` (ברירת מחדל) / `popular` | `popular` = הכי הרבה לייקים קודם |
| `page`, `limit` | מספרים | עמודים (ברירת מחדל 1 ו־10) |

דוגמה: `/api/posts?search=react&language=TYPESCRIPT&sort=popular&page=2`

### תגובות
| Method | URL | הרשאה | Body | הצלחה |
|---|---|:-:|---|---|
| GET | `/api/posts/:id/comments` | 🔓 | `?page&limit` | `200 Page<Comment>` (הישנה ראשונה) |
| POST | `/api/posts/:id/comments` | 🔑 | `{ content }` | `201 { comment }` |
| DELETE | `/api/comments/:id` | 🔑 כותב/ת או 👑 | – | `204` |

### קטגוריות
| Method | URL | הרשאה | Body | הצלחה |
|---|---|:-:|---|---|
| GET | `/api/categories` | 🔓 | – | `200 { items: Category[] }` (בלי עמודים) |
| POST | `/api/categories` | 👑 | `{ name, description? }` | `201 { category }` |
| PATCH | `/api/categories/:id` | 👑 | `{ name?, description? }` | `200 { category }` |
| DELETE | `/api/categories/:id` | 👑 | – | `204`, או `409` אם יש בה פוסטים |

### תמונות
| Method | URL | הרשאה | הצלחה |
|---|---|:-:|---|
| GET | `/api/images/:id` | 🔓 | קובץ התמונה |

---

## 5. אילו Endpoints צריך בכל מסך

| # | מסך | Endpoints |
|---|---|---|
| 1 | **הרשמה** | `POST /api/auth/register`. אחרי הצלחה שומרים token ועוברים לפיד |
| 2 | **התחברות** | `POST /api/auth/login` |
| – | **טעינת האפליקציה** | `GET /api/auth/me` (אם יש token שמור) |
| 3 | **פיד ראשי** | `GET /api/posts` (עם search, categoryId, language, feed, sort, page), `GET /api/categories` (לרשימת הסינון), `POST/DELETE /api/posts/:id/like`, `POST/DELETE /api/posts/:id/save` |
| 4 | **פוסט בודד** | `GET /api/posts/:id`, `GET /api/posts/:id/comments`, `POST /api/posts/:id/comments`, `DELETE /api/comments/:id`, לייק ושמירה, `DELETE /api/posts/:id` |
| 5 | **יצירה או עריכה של פוסט** | `GET /api/categories`, `POST /api/posts` **ואחר כך** (אם נבחרה תמונה) `PUT /api/posts/:id/image`. בעריכה: `GET /api/posts/:id`, `PATCH /api/posts/:id`, `PUT/DELETE /api/posts/:id/image` |
| 6 | **⭐ האזור האישי שלי** | `GET /api/users/me/dashboard` (פרטים ומספרים). לשונית "הפוסטים שלי": `GET /api/posts?authorId=<user.id>`. לשונית "שמורים": `GET /api/users/me/saved-posts` |
| 7 | **פרופיל משתמש** | `GET /api/users/:id`, `GET /api/posts?authorId=:id`, `POST/DELETE /api/users/:id/follow` |
| 8 | **עוקבים ונעקבים** | `GET /api/users/:id/followers`, `GET /api/users/:id/following` |
| 9 | **עריכת הפרופיל שלי** | `GET /api/auth/me`, `PATCH /api/users/me`, `PUT /api/users/me/avatar`, `DELETE /api/users/me/avatar` |
| 10 | **ניהול קטגוריות 👑** | `GET /api/categories`, `POST /api/categories`, `PATCH /api/categories/:id`, `DELETE /api/categories/:id` |
| 11 | **ניהול משתמשים 👑** | `GET /api/users?search=&page=` |

### דוגמה: תשובת האזור האישי
```json
{
  "user": { "id": 2, "name": "Noa Cohen", "email": "noa@codenest.dev", "bio": "...", "role": "USER", "avatarUrl": null, "createdAt": "..." },
  "stats": { "postsCount": 3, "followersCount": 2, "followingCount": 1, "savedCount": 2, "likesReceived": 7 }
}
```

### דוגמה: יצירת פוסט
```http
POST /api/posts
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Tip: Optional chaining",
  "content": "Use ?. to stop safely at the first null.",
  "codeSnippet": "const city = user?.address?.city;",
  "language": "JAVASCRIPT",
  "categoryId": 1
}
```
תשובה `201`:
```json
{
  "post": {
    "id": 12, "title": "Tip: Optional chaining", "content": "...",
    "codeSnippet": "const city = user?.address?.city;", "language": "JAVASCRIPT",
    "imageUrl": null, "category": { "id": 1, "name": "Tips" },
    "author": { "id": 2, "name": "Noa Cohen", "avatarUrl": null },
    "likesCount": 0, "commentsCount": 0, "likedByMe": false, "savedByMe": false,
    "createdAt": "2026-10-14T09:30:00.000Z", "updatedAt": "2026-10-14T09:30:00.000Z"
  }
}
```

---

## 6. תמונות: העלאה ותצוגה

### העלאה (`PUT /api/users/me/avatar` או `PUT /api/posts/:id/image`)
- סוג הבקשה: **`multipart/form-data`**. משתמשים באובייקט `FormData` של הדפדפן.
- שם השדה: **`image`** בדיוק.
- קובץ אחד, **JPG, PNG או WEBP**, עד **2MB**.
- ⚠️ **אל תגדירי** את הכותרת `Content-Type` בעצמך בבקשה הזאת. הדפדפן מגדיר אותה לבד (כולל ה־boundary). את הכותרת `Authorization` כן שולחים.
- השרת בודק את תוכן הקובץ עצמו. קובץ שאינו תמונה אמיתית יחזיר `400` גם אם הסיומת שלו ‎.png.
- יצירת פוסט עם תמונה מתבצעת ב**שתי בקשות**: קודם `POST /api/posts` (JSON), ואחר כך `PUT /api/posts/<id שחזר>/image` (FormData).

### תצוגה
- `avatarUrl` ו־`imageUrl` הן **כתובות יחסיות**, למשל `/api/images/3f2b...`.
- כדי להציג תמונה, מחברים: `BASE_URL + imageUrl`, למשל `https://codenest-api.onrender.com/api/images/3f2b...`.
- אם הערך הוא `null`, מציגים תמונת ברירת מחדל (למשל עיגול עם האות הראשונה של השם).
- לא צריך token כדי להציג תמונה.
- **מאחורי הקלעים:** הקבצים שמורים ב־**Cloudflare R2**, והשרת מגיש אותם בכתובת **קבועה** `/api/images/...`. פשוט שמים אותה ב־`<img src>`.

---

## 7. שדות חובה בטפסים (כדאי לבדוק כבר בצד הלקוח)

| טופס | שדה | חוקים |
|---|---|---|
| הרשמה | `name` | חובה, 2–50 תווים |
| | `email` | חובה, אימייל תקין |
| | `password` | חובה, 8–72 תווים, לפחות אות אחת ומספר אחד |
| התחברות | `email`, `password` | חובה |
| פוסט | `title` | חובה, 3–120 תווים |
| | `content` | חובה, 1–5000 תווים |
| | `categoryId` | חובה, מספר של קטגוריה קיימת |
| | `codeSnippet` | רשות, עד 10,000 תווים |
| | `language` | רשות, אחד מערכי Language או `null` |
| תגובה | `content` | חובה, 1–1000 תווים |
| פרופיל | `name` | רשות, 2–50 תווים |
| | `bio` | רשות, עד 300 תווים. `""` או `null` מוחקים אותו |
| קטגוריה 👑 | `name` | חובה, 2–40 תווים, ייחודי (בלי הבדל בין אותיות גדולות לקטנות) |
| | `description` | רשות, עד 200 תווים |
| תמונה | `image` | JPG/PNG/WEBP, עד 2MB |

ב־**PATCH** שולחים רק את השדות שהשתנו, אבל לפחות שדה אחד.

---

## 8. שגיאות

**כל** שגיאה חוזרת באותו מבנה:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields are missing or invalid",
    "details": [
      { "field": "title", "message": "Title must be at least 3 characters" }
    ]
  }
}
```
`details` קיים רק בשגיאות ולידציה. אפשר להשתמש ב־`field` כדי להציג את השגיאה ליד השדה המתאים בטופס.

| סטטוס | `code` | מתי | מה לעשות ב־UI |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | שדה חסר או לא תקין | להציג את ההודעות ליד השדות |
| 400 | `INVALID_JSON` | גוף הבקשה שבור | באג בקוד ששולח את הבקשה |
| 400 | `CATEGORY_NOT_FOUND` | קטגוריה לא קיימת | לרענן את רשימת הקטגוריות |
| 400 | `CANNOT_FOLLOW_SELF` | ניסיון לעקוב אחרי עצמי | להסתיר את כפתור "עקוב" כש־`isMe` |
| 400 | `FILE_REQUIRED` / `INVALID_FILE_TYPE` / `UPLOAD_ERROR` | בעיה בקובץ | "יש לבחור תמונה מסוג JPG, PNG או WEBP" |
| 401 | `TOKEN_MISSING` / `TOKEN_INVALID` / `TOKEN_EXPIRED` | לא מחובר/ת או שה־token פג | למחוק את ה־token ולעבור להתחברות |
| 401 | `INVALID_CREDENTIALS` | אימייל או סיסמה שגויים | "אימייל או סיסמה שגויים" |
| 403 | `FORBIDDEN` | אין הרשאה | "אין לך הרשאה לפעולה זו" |
| 404 | `NOT_FOUND` | פוסט, משתמש או תגובה לא קיימים | דף "לא נמצא" |
| 409 | `EMAIL_TAKEN` | אימייל תפוס בהרשמה | "האימייל כבר רשום" |
| 409 | `CATEGORY_EXISTS` / `CATEGORY_IN_USE` | שם תפוס, או קטגוריה שיש בה פוסטים | להציג את `message` |
| 413 | `FILE_TOO_LARGE` | תמונה גדולה מ־2MB | "התמונה גדולה מדי (מקסימום 2MB)" |
| 502 | `STORAGE_ERROR` | שירות אחסון התמונות לא זמין לרגע | "העלאת התמונה נכשלה, נסי שוב" |
| 503 | `STORAGE_NOT_CONFIGURED` | אחסון התמונות לא הוגדר בשרת | "העלאת תמונות לא זמינה כרגע" |
| 429 | `TOO_MANY_REQUESTS` | יותר מדי ניסיונות התחברות | "נסי שוב בעוד כמה דקות" |
| 500 | `INTERNAL_ERROR` | תקלה בשרת | "משהו השתבש, נסי שוב" |

💡 תשובות `204` מגיעות **בלי גוף**, אז אין לנסות לקרוא מהן JSON.

---

## 9. סיכום הרשאות

| פעולה | אורחת (בלי token) | משתמש רגיל | מנהל |
|---|:-:|:-:|:-:|
| צפייה בפוסטים, תגובות, פרופילים, עוקבים וקטגוריות | ✅ | ✅ | ✅ |
| פיד "ממי שאני עוקבת" (`feed=following`) | ❌ 401 | ✅ | ✅ |
| יצירת פוסט, תגובה, לייק, שמירה, מעקב | ❌ 401 | ✅ | ✅ |
| עריכת פוסט | ❌ 401 | רק שלי | רק שלו/שלה |
| מחיקת פוסט או תגובה | ❌ 401 | רק שלי | **הכול** |
| הפוסטים השמורים, האזור האישי | ❌ 401 | רק שלי | רק שלו/שלה |
| אימייל של משתמשים אחרים | ❌ (`null`) | ❌ (`null`) | ✅ |
| ניהול קטגוריות | ❌ 401 | ❌ 403 | ✅ |
| רשימת כל המשתמשים | ❌ 401 | ❌ 403 | ✅ |

**מה אורחת מקבלת בעמודים הציבוריים:** `likedByMe: false`, `savedByMe: false`, `isFollowedByMe: false`, `isMe: false`.
💡 **טיפ ל־UI:** כשאורחת לוחצת על לייק, שמירה, תגובה או מעקב, עדיף להעביר אותה למסך ההתחברות (או להציג "יש להתחבר"), במקום לשלוח בקשה ולקבל 401.
⚠️ אם נשלח token **פג תוקף** גם לעמוד ציבורי, השרת מחזיר 401. כך האפליקציה יודעת לנתק את המשתמשת ולמחוק את ה־token.

**טיפ ל־UI:** הציגי כפתורי "ערוך" ו"מחק" רק כש־`post.author.id === user.id` (ומחיקה גם כש־`user.role === "ADMIN"`). השרת חוסם בכל מקרה, אבל כך המשתמש לא רואה כפתורים שלא יעבדו.

---

## 10. CORS

אם הדפדפן מראה `blocked by CORS policy`, צריך להוסיף את כתובת אתר ה־React למשתנה `CORS_ORIGIN` בשרת. למשל:
`CORS_ORIGIN=http://localhost:5173,https://my-codenest.vercel.app`
(בלי `/` בסוף, ועם פסיק בין כתובות). הסבר מלא נמצא ב־`START-HERE.md`, בטבלת התקלות.
