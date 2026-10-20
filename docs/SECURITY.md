# Security notes

Implemented and covered by automated tests unless marked otherwise.

- **Staff passwords:** scrypt with a random salt, constant-time comparison. Login is rate limited and returns the same error for unknown users and wrong passwords.
- **Sessions:** signed JWT (HS256) in an `HttpOnly`, `SameSite=Lax` cookie, 12-hour expiry, `Secure` when `COOKIE_SECURE=true`. The server refuses to start in production with a `JWT_SECRET` shorter than 32 characters. Deactivated accounts are rejected on every request.
- **Authorisation:** procedures are `public`, `staff` or `admin`. Officers are scoped to their department in the data layer; cases outside it return "not found".
- **Citizen ownership:** anything that changes a case (evidence, rating, reopen) needs the tracking number and the private access code. The code is stored only as a SHA-256 hash and compared in constant time. This matters because tracking numbers are sequential and therefore guessable.
- **Public privacy:** public views never include location, full email, staff names (roles only) or internal notes. Email is masked (`r***@example.com`) everywhere.
- **Uploads:** PDF, PNG, JPG, WebP only, identified by file signature (not the browser's claim), 2 MB cap, 5 per case, random server-generated names, extension forced to the real type, path-traversal protection. Served only to the department, admins, or the owner, with `nosniff` and a sandboxing CSP. Unauthorised requests get the same 404 as missing files.
- **Cross-site requests:** state-changing `/api` calls with a foreign `Origin` are rejected, on top of `SameSite=Lax`.
- **Rate limits:** general API limit, stricter limits on login and on public mutations (filing, uploads, rating, reopen, access-code checks).
- **Headers:** helmet with a strict CSP (scripts, styles and fonts all from the same origin), no `X-Powered-By`.
- **Input:** every input is validated with zod. SQL goes through Drizzle parameters.

## Known limits (not done)

- No malware scanning of uploads.
- No password reset, email verification or multi-factor authentication for staff.
- No account lockout beyond rate limiting. Rate-limit counters are in memory (reset on restart, per node).
- Contact email is stored as plain text in the database. It is masked in every screen but not encrypted at rest.
- Email is collected but not sent: there are no notifications yet.
- A case's description is public to anyone with its tracking number. Tell citizens not to put personal details in it.
- **Demo mode** (`DEMO_MODE=true`) publishes staff credentials on the sign-in page. Use it for demonstrations only.
- Not independently security tested. Treat it as a strong starting point, not an audited system.
