# Deployment

1. `cp .env.example .env` and set at least:
   - `JWT_SECRET`: 32+ random characters (`openssl rand -hex 32`)
   - `ADMIN_PASSWORD` (12+ characters), optionally `OFFICER_PASSWORD`
   - `COOKIE_SECURE=true` once served over HTTPS, and `TRUST_PROXY=1` behind a reverse proxy
2. `docker compose up -d --build`
3. Create the first accounts: `docker compose exec app npm run seed`
4. Put it behind HTTPS (Caddy, nginx or a cloud load balancer). Health check: `GET /healthz`.
5. Back up the `civicresolve-data` volume (database and uploads). For a consistent copy of the database while running: `sqlite3 civicresolve.db ".backup backup.db"`.

The department and category catalog is created automatically on first start and is editable from the admin screens.

**Demo deployments:** set `DEMO_MODE=true` and run `npm run seed` to get four demo staff accounts, twelve sample cases, and one-click credentials on the staff sign-in page. Never do this on a real site.

Run one instance only. SQLite and local file storage are single-node.
