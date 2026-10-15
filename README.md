# Tata EV Diagnostics

Failed-sessions dashboard with its own login page, database and automatic updates.
Hosted on **Netlify** from GitHub; no other services needed.

- Website: React, built by Netlify on every `git push`
- Login and data: one Netlify Function (`netlify/functions/api.mjs`)
- Database: Netlify Blobs (Netlify's built-in storage), created on first use with 37 sessions
  (7 real + 30 dummy rows marked as sample)
- Updates: every open dashboard checks for changes every 15 seconds and refreshes by itself

## Deploy on Netlify

1. **Push this folder to GitHub** (all files, including `netlify.toml` and the `netlify` folder).
2. Sign in at **app.netlify.com** → **Add new project** → **Import an existing project** → **GitHub**
   → pick the repository. Netlify reads the build settings from `netlify.toml`; leave them as shown.
3. Before deploying, open **Add environment variables** (or later: **Project configuration →
   Environment variables**) and add:

   | Key | Value |
   |---|---|
   | `ADMIN_EMAIL` | your email; this becomes the first admin login |
   | `ADMIN_PASSWORD` | a strong password (8+ characters) |
   | `SESSION_SECRET` | any long random text, 32+ characters (e.g. mash the keyboard) |

4. Click **Deploy**. When it finishes, open the `https://<name>.netlify.app` link and sign in
   with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

If you add or change environment variables after a deploy, go to **Deploys → Trigger deploy →
Deploy project** so the function picks them up.

`ADMIN_EMAIL`/`ADMIN_PASSWORD` are only used the very first time, when there are no users yet.
After that, manage logins inside the app.

## Using it

**Manage data** (admins only, top right):

- **Add a session**: type in one failed session.
- **Import CSV**: same columns as the Failed Sessions extract
  (`Date, Time, EVSE ID, Connector, Location, CDM Session ID, Start phase`;
  optional `Stop reason, Error code, Charger model`). Date and time are IST. Existing CDM Session IDs are skipped.
- **Manage users**: add people, reset passwords (logs them out everywhere), set Viewer/Admin, remove.
- **Remove dummy rows**: deletes the 30 sample sessions.

| Role | Can do |
|---|---|
| Viewer | Dashboard, filters, session details, CSV export |
| Admin | Everything above + add/import/delete data + manage users |

Changes appear on everyone's open dashboard within about 15 seconds (instantly for the person who made them).

## Updating the code

Edit, commit, push. Netlify rebuilds automatically. Your data and users are kept
(they live in Netlify Blobs, not in the code).

## Running on your own computer (optional)

Needs Node.js 22.13+ (Node 24 LTS recommended).

```
npm install
npm start
```

Open http://localhost:3000 and sign in with `admin@tataev.local` / `ChangeMe@123`.
This local mode uses a SQLite file (`data/tata-ev.db`) and updates instantly instead of every 15 seconds.
It is separate from the Netlify data.

## Files

- `src/`: React dashboard (Vite + Recharts)
- `netlify/functions/api.mjs`, `netlify/lib/`: the Netlify API (login, data, users) and first-run data
- `server/`: the optional local server (Express + SQLite)
- `netlify.toml`: Netlify build settings
- `data/failed_sessions_37.csv`: the 37 starting sessions
