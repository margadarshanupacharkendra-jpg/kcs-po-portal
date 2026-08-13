# Kshamadevi Construction — PO Portal

A purchase-order register, PO builder, dashboard, and Excel/PDF export
for Kshamadevi Construction Solution Pvt. Ltd. Records are stored in a
shared Redis database (Upstash, via Vercel Marketplace), so everyone who
logs in sees and edits the same register.

## Logins

Two accounts are built in (change them any time — see "Changing the
passwords" below):

| Role  | Username  | Password  | Can do |
|-------|-----------|-----------|--------|
| Admin | `ksdadmin` | `ksd@pw`   | Everything — create, edit, delete |
| User  | `ksduser`  | `ksd@user` | Create new purchase orders only. Cannot edit or delete existing ones (the server rejects those requests even if attempted directly, not just hidden in the interface). |

## Deploy to Vercel (no local setup needed)

1. **Push this folder to GitHub**
   - Create a new empty repo on GitHub (e.g. `kcs-po-portal`).
   - Upload this whole folder to it (drag-and-drop on GitHub's web UI
     works fine, or `git init && git add . && git commit -m "init" && git push`).

2. **Import into Vercel**
   - Go to vercel.com → **Add New… → Project** → import the GitHub repo you just created.
   - Framework preset: Vercel auto-detects **Next.js** — leave defaults, click **Deploy**.
   - The first deploy will succeed but the app won't work yet (no database, no session secret).

3. **Add the database — Upstash Redis**
   - In your new project on Vercel, go to the **Storage** tab → **Marketplace Database Providers** → **Upstash** → create a Redis database.
   - Connect it to this project. Vercel will automatically add `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — the app reads either).

4. **Set a session secret** (Project Settings → Environment Variables)
   - Add `SESSION_SECRET` = any long random string (this signs the login cookie so it can't be forged). Example: generate one at random, or run `openssl rand -hex 32` locally.

5. **(Optional) Change the login passwords**
   - Add `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `STAFF_USERNAME`, `STAFF_PASSWORD` in the same
     Environment Variables screen to override the defaults in the table above.

6. **Redeploy**
   - Go to **Deployments** → **⋯** on the latest deployment → **Redeploy** (this picks up the new environment variables).
   - Open the deployment URL, sign in, and the portal should load with an empty register.

That's it — the URL Vercel gives you (e.g. `kcs-po-portal.vercel.app`) is
now your in-house portal.

## Running locally (optional)

```bash
npm install
# copy real values from Vercel > Storage > your Redis DB > .env.local tab into .env.local
npm run dev
```

## Changing the passwords later

Go to Vercel → your project → **Settings → Environment Variables**, set/update
`ADMIN_PASSWORD` and `STAFF_PASSWORD` (and usernames if you want), then redeploy.
No code changes needed.

## Notes

- **Two roles only, no per-person accounts.** Everyone with the admin
  password has full admin rights; everyone with the user password can
  only add entries. If you later want individual named logins with an
  audit trail of who created/edited what, that's a bigger addition —
  ask if you want it built.
- **Every PO is stored as its own record**, not as one shared list, so
  two people saving at the same moment can never overwrite each
  other's entry.
- **PO numbers are assigned by the server**, using an atomic counter —
  they always increase and can never collide, even if two people
  create a purchase order at the same instant. You won't see the
  number until after you save a new PO.
- **Autosuggest**: supplier, address, contact, project, payment terms,
  and line-item description/unit fields suggest values you've typed
  into previous purchase orders, as you type.
- **Excel export** and **PDF export** (register-wide, or per PO via
  the print icon) both run entirely in the visitor's browser — no
  server changes needed for those.
