# 🖼️ מעבר אחסון התמונות ל־Cloudflare R2

## הארכיטקטורה החדשה

```
React  ──<img src="/api/images/:id">──►  Render (Express API)
                                            │  1. מוצא את התמונה ב־Neon (רק key + מטא־דאטה)
                                            │  2. עונה 302 → כתובת חתומה וזמנית ב־R2
                                            ▼
                         Cloudflare R2 (הקבצים עצמם, Bucket פרטי)
```

| שירות | מה הוא שומר / עושה |
|---|---|
| **Cloudflare R2** | קובצי התמונות עצמם (`images/<uuid>.png` וכו'). ה־Bucket **פרטי**. |
| **Neon PostgreSQL** | טבלת `images`: `storage_key`, `mime_type`, `size`, `storage_verified_at` והקשרים לפוסטים ולמשתמשים. **בלי** תוכן הקבצים. |
| **Render** | השרת. רק הוא מחזיק את מפתחות R2 (משתני סביבה), ורק הוא מעלה, מוחק ומייצר כתובות חתומות. |
| **GitHub** | הקוד, ה־migrations והסקריפטים. **בלי סודות**. |

**צד ה־React לא משתנה:** `imageUrl` / `avatarUrl` נשארים `/api/images/<id>`. הדפדפן עוקב אחרי ה־redirect לבד.

## איך זה עובד

**העלאה** (`PUT /api/users/me/avatar`, `PUT /api/posts/:id/image`):
1. בדיקת הקובץ: עד 2MB, ובדיקה של התוכן עצמו (JPG, PNG או WEBP).
2. העלאה ל־R2 עם מפתח חדש: `images/<uuid>.<ext>`. אם R2 לא זמין, השרת מחזיר **502** ולא משנה שום דבר במסד.
3. **טרנזקציה אחת** במסד: יצירת השורה ב־`images`, קישור לפוסט או למשתמש, ומחיקת השורה הישנה.
4. אם שלב המסד נכשל, הקובץ החדש **נמחק מ־R2**, כך שלא נשארים קבצים יתומים.
5. רק אחרי הצלחה נמחק הקובץ הישן מ־R2.

**מחיקה:** קודם המסד (טרנזקציה), ורק אחר כך הקובץ. אם R2 לא זמין ברגע המחיקה, הבקשה עדיין מצליחה והמסד נשאר תקין. הקובץ שנשאר נמחק אחר כך בעזרת `images:cleanup-orphans`.

**הצגה:** `GET /api/images/:id` מחזיר **302** לכתובת חתומה (`IMAGE_URL_TTL_SECONDS`, ברירת מחדל שעה). תמונות ישנות שעוד לא הועברו נשלחות ישירות מהמסד (**200**).

**בלי הגדרות R2:** השרת עולה, `/api/health` מציג `"storage": "not_configured"`, העלאות מחזירות **503**, ותמונות ישנות ממשיכות לעבוד.

## שינויי מסד הנתונים

Migration בשם `20261018120000_r2_image_storage`. היא **מוסיפה בלבד ובטוחה**:
- `storage_key VARCHAR(512) UNIQUE` (עם אילוץ `LIKE 'images/%'`)
- `storage_verified_at TIMESTAMP`
- `data` הופך ל־NULLABLE. **לא נמחק שום מידע.**
- אילוץ `images_has_content`: לכל שורה חייב להיות `data` **או** `storage_key`.

השלב הבא, מחיקה מלאה של העמודה `data`, יהיה Migration **נפרדת** בעתיד, רק אחרי שכל התמונות הועברו ואומתו.

## העברת תמונות קיימות (Runbook)

> ⚠️ את כל הפקודות מריצים מתיקיית הפרויקט במחשב. חשוב לכתוב את `--` לפני הפרמטרים.
> שמרי את ההגדרות של סביבת הייצור בקובץ פרטי, למשל `.env.production.local`. הקובץ כבר מוחרג מ־Git.
> בקובץ צריכים להיות `DATABASE_URL` (של Neon), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` ו־`R2_BUCKET`.

| # | פקודה | מה היא עושה | הרסנית? |
|---|---|---|:-:|
| 0 | **ב־Neon:** Branches ← Create branch | גיבוי מלא של המסד (Branch מנקודת הזמן הנוכחית) | לא |
| 1 | `npm run images:backup -- --env-file=.env.production.local` | מעתיקה כל תמונה ישנה לתיקייה מקומית, יחד עם `manifest.json` ו־SHA-256 | לא |
| 2 | `npm run images:migrate-to-r2 -- --dry-run --env-file=.env.production.local` | מציגה מה היה מועבר | לא |
| 3 | `npm run images:migrate-to-r2 -- --env-file=.env.production.local` | מעלה ל־R2, **מורידה בחזרה ומשווה SHA-256**, ורק אז שומרת את המפתח. **הנתונים הישנים נשארים** | לא |
| 4 | `npm run images:verify -- --env-file=.env.production.local` | בודקת שכל אובייקט קיים, בגודל הנכון ובתוכן הנכון | לא |
| 5 | `npm run images:purge-db-data -- --env-file=.env.production.local` | מציגה מה היה נמחק (בלי למחוק בפועל) | לא |
| 6 | `npm run images:purge-db-data -- --confirm --env-file=.env.production.local` | מנקה את `data` **רק** בשורות מאומתות, אחרי בדיקה נוספת מול R2 באותו רגע | **כן**, אחרי אישור |
| ✚ | `npm run images:cleanup-orphans -- [--confirm] --env-file=...` | קבצים ב־R2 שאף שורה לא מצביעה עליהם (בני יותר משעה) | רק עם `--confirm` |

כל הפקודות **בטוחות להרצה חוזרת**.

## בדיקות שבוצעו
- `tests/imageStorage.test.ts`: העלאה, 302, החלפה, מחיקה, קובץ לא תקין, נפילת R2 (בהעלאה, במחיקה ובהצגה), נפילת מסד (בהעלאה ובמחיקה), R2 לא מוגדר ותמונות ישנות.
- `tests/imageMigration.test.ts`: dry-run, העברה ואימות, תקלה באמצע, תוכן משובש, גיבוי, purge בטוח וקבצים יתומים.
- `tests/r2Storage.integration.test.ts`: הקוד **האמיתי** מול שרת S3 אמיתי (SeaweedFS ב־Docker): העלאה, קריאה, כתובת חתומה, חתימה מזויפת (403), זרימה מלאה דרך ה־API, העברה, מפתח שגוי ושרת לא זמין.
  להרצה: `docker compose --profile s3 up -d`, ואחר כך `S3_TEST_ENDPOINT=http://localhost:8333 npm test`.
