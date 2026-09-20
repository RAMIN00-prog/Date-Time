# Date Time V2.5

הגרסה כוללת:
- V1 + V2
- קישורים אישיים
- API
- Admin מוגן ב-token
- בדיקת תאריך/שעה עתידיים
- validation בסיסי
- endpoint לבדיקת בריאות השירות
- הפרדה ברורה בין public לשרת

הרצה:
npm install
ADMIN_TOKEN=your-secret npm start

Windows PowerShell:
$env:ADMIN_TOKEN='your-secret'; npm start

כתובות:
http://localhost:3000
http://localhost:3000/admin.html

הערה: data.json עדיין משמש כאחסון אבטיפוס. בשלב הבא אפשר להחליף אותו ב-PostgreSQL ולהוסיף תזכורות והתראות. לפני פרסום ציבורי יש להוסיף HTTPS, rate limiting, CSRF/Origin protection לפי הארכיטקטורה, ניהול secrets ו-backup.
