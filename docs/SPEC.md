# 📘 מסמך אפיון: CodeNest (גרסה מאושרת)

## א. תיאור הפרויקט
| | |
|---|---|
| **שם** | CodeNest |
| **מטרה** | רשת חברתית לשיתוף ידע בין מתכנתים: טיפים, קטעי קוד ופתרונות |
| **קהל יעד** | מתכנתים בכל הרמות |
| **משתמשים** | משתמש רגיל (USER) ומנהל/ת (ADMIN) |
| **גישה** | כל התוכן זמין רק למשתמשים מחוברים |

## ב. מסכים
| # | מסך | מה אפשר לעשות |
|---|---|---|
| 1 | הרשמה | שם, אימייל, סיסמה |
| 2 | התחברות | אימייל, סיסמה |
| 3 | פיד ראשי | חיפוש, סינון (קטגוריה או שפה), מיון (חדשים או פופולריים), "כולם" או "ממי שאני עוקב/ת", לייק, שמירה |
| 4 | פוסט בודד | קוד, תמונה, לייק, שמירה, תגובות, עריכה ומחיקה של פוסט שלי |
| 5 | יצירה ועריכה של פוסט | כותרת, תוכן, קוד, שפה, קטגוריה, תמונה |
| 6 | ⭐ האזור האישי שלי | כפתור "העלאת פוסט", מספרים (פוסטים, עוקבים, נעקבים, שמורים, לייקים שקיבלתי), לשוניות "הפוסטים שלי" ו"שמורים" |
| 7 | פרופיל משתמש | פרטים, הפוסטים שלו, עקוב / הפסק לעקוב |
| 8 | עוקבים ונעקבים | רשימות משתמשים |
| 9 | עריכת הפרופיל שלי | שם, Bio, תמונת פרופיל |
| 10 | ניהול קטגוריות (מנהל) | הוספה, עריכה, מחיקה של קטגוריה ריקה |
| 11 | ניהול משתמשים (מנהל) | רשימה וחיפוש לפי שם או אימייל |

## ג. הרשאות
| פעולה | אורח | משתמש | מנהל |
|---|:-:|:-:|:-:|
| הרשמה והתחברות | ✅ | – | – |
| צפייה בתוכן | ❌ | ✅ | ✅ |
| יצירת פוסט, תגובה, לייק, שמירה, מעקב | ❌ | ✅ | ✅ |
| עריכת פוסט | ❌ | רק שלי | רק שלו/שלה |
| מחיקת פוסט או תגובה | ❌ | רק שלי | הכול |
| צפייה בשמורים | ❌ | רק שלי | רק שלו/שלה |
| צפייה באימייל של אחרים | ❌ | ❌ | ✅ |
| ניהול קטגוריות, רשימת משתמשים | ❌ | ❌ | ✅ |

## ד. מסד הנתונים
| טבלה | מטרה | שדות עיקריים | מפתחות וקשרים | אילוצים |
|---|---|---|---|---|
| `users` | משתמשים | id, name, email, password_hash, bio, role, avatar_image_id, created_at, updated_at | PK id · FK avatar_image_id → images (SET NULL) | email ייחודי, name באורך 2 לפחות |
| `categories` | קטגוריות | id, name, description, created_at | PK id | name ייחודי, באורך 2 לפחות |
| `posts` | פוסטים (האובייקט המרכזי) | id, title, content, code_snippet, language, category_id, author_id, image_id, created_at, updated_at | PK id · FK category_id → categories (RESTRICT) · FK author_id → users (CASCADE) · FK image_id → images (SET NULL) | title 3–120, content 1–5000, code עד 10,000 |
| `comments` | תגובות | id, content, post_id, author_id, created_at | PK id · FK post_id → posts (CASCADE) · FK author_id → users (CASCADE) | content 1–1000 |
| `likes` | לייקים | user_id, post_id, created_at | PK משותף (user_id, post_id) · FKs (CASCADE) | לייק אחד לכל משתמש לכל פוסט |
| `saved_posts` | שמורים | user_id, post_id, created_at | PK משותף · FKs (CASCADE) | שמירה אחת לכל משתמש לכל פוסט |
| `follows` | מעקב | follower_id, following_id, created_at | PK משותף · FKs → users (CASCADE) | CHECK: follower ≠ following |
| `images` | תמונות | id (UUID), data, mime_type, size, created_at | PK id | רק jpeg/png/webp, עד 2MB |

**ערכי `role`:** USER, ADMIN.
**ערכי `language`:** JAVASCRIPT, TYPESCRIPT, PYTHON, JAVA, CSHARP, CPP, C, PHP, GO, RUST, KOTLIN, SWIFT, SQL, HTML_CSS, OTHER.

## ה. Endpoints
הפירוט המלא (Request, Response ודוגמאות) נמצא ב־Swagger (`/api-docs`), ב־`docs/openapi.json` וב־`FRONTEND-API-GUIDE.md`.

## ו. התאמה לדרישות החובה
| דרישה | מימוש |
|---|---|
| התחברות | register, login ו־JWT |
| שני סוגי משתמשים | USER ו־ADMIN |
| אובייקט מרכזי | Post |
| 5 שדות ומעלה | title, content, codeSnippet, language, category, image |
| רשימה, הוספה, עריכה | GET, POST ו־PATCH ב־`/api/posts` |
| שדה בחירה | קטגוריה ושפת תכנות |
| חיפוש, סינון, מיון | search, categoryId, language, authorId, feed, sort |
| מסד נתונים אמיתי | PostgreSQL עם Prisma |
