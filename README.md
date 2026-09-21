# Date Time — production-ready v3

Date Time is a small Express + PostgreSQL web app for creating personal invitations and collecting the selected date details.

## What changed from the prototype

- PostgreSQL instead of `data.json` for persistent storage.
- Parameterized SQL queries.
- Security headers via Helmet.
- Rate limiting for API traffic and write operations.
- Same-origin protection for state-changing browser requests.
- Required production secrets; no default admin token in production.
- Input validation and bounded field lengths.
- Health endpoint for hosting providers.
- Server binds to `0.0.0.0` for cloud hosting.
- Admin results are rendered safely in the browser instead of injecting raw user text as HTML.
- Render Blueprint included for a straightforward deployment.

## Local development

1. Create a PostgreSQL database.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and `ADMIN_TOKEN`.
3. Install dependencies:

```bash
npm install
```

4. Start:

```bash
npm start
```

Open `http://localhost:3000`.

## Render deployment

The included `render.yaml` creates one web service and one PostgreSQL database. Render supports connecting a Git repository to a Web Service and automatically deploying pushes. The Blueprint asks for the secret `ADMIN_TOKEN` instead of storing it in Git.

For a real production launch, use a paid database/service plan when the app becomes important; Render's free Postgres has a 30-day expiration and no backups.

## Production checklist

- [ ] Connect GitHub repository to Render.
- [ ] Create the Blueprint from `render.yaml`.
- [ ] Set a strong random `ADMIN_TOKEN` in Render.
- [ ] Test `/api/health`.
- [ ] Create an invitation from `/` and open the generated invite link on a second device.
- [ ] Test the Admin page.
- [ ] Upgrade hosting/database from free plans before relying on the service for important data.
- [ ] Add a custom domain when ready.
- [ ] Add email/WhatsApp/SMS notifications through a separate provider; do not put provider secrets in browser code.
- [ ] Add automated database backups/exports appropriate to the chosen hosting plan.
