# Track My Roadmap

[trackmyroadmap.com](https://www.trackmyroadmap.com): a home page of roadmap cards, a tracker page per roadmap, and a habit tracker. Built with Next.js (App Router), TypeScript, Tailwind CSS and Supabase (Google sign-in + Postgres).

Planned features are listed in [IMPROVEMENTS.md](IMPROVEMENTS.md).

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in the two Supabase values (optional: without them, progress saves on this device only)
npm run dev                  # http://localhost:3000
```

## Where things are

| Path | What it is |
|---|---|
| `content/roadmaps/data/*.json` | Roadmap content. One file per roadmap. |
| `content/roadmaps/index.ts` | The list of roadmaps shown on the home page, plus the "Coming soon" cards. |
| `lib/roadmap.ts` | Turns roadmap JSON into phases, cards and topics, and works out progress. |
| `lib/useCloudDoc.ts` | Saves progress on the device and syncs it to the signed-in account (newest copy wins). |
| `components/roadmap/RoadmapTracker.tsx` | The roadmap page (phase rail, cards, search, "Up next"). |
| `components/habits/HabitTracker.tsx` | The habit tracker page. |
| `app/tracker.css` | Tracker styles carried over from the original site. New UI uses Tailwind classes. |
| `supabase/schema.sql` | Database tables and access rules. |
| `app/admin/`, `components/admin/ResourceEditor.tsx` | Admin dashboard: recommended YouTube videos per topic. |

## Add a roadmap

1. Copy `content/roadmaps/data/software-engineer.json` to `content/roadmaps/data/frontend-developer.json`.
2. Change `slug`, `title`, `tagline`, the phases and their items. Give it its own `localKey`, e.g. `tmr-progress-frontend-developer`.
3. Run `node scripts/gen-roadmap-index.mjs`. New roadmaps appear in the public catalogue automatically.

Item format: `["Topic"]` or `["Card title", ["Topic", "Topic"]]`. End a name with `?` for optional, `^` for advanced, `~` for an ongoing habit, `!` on a card title for "pick one". Topic keys are built from names, so renaming a topic resets its tick for everyone.

## Set up Supabase (once)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → New query → paste `supabase/schema.sql` → Run.
3. **Google sign-in**
   - In [Google Cloud Console](https://console.cloud.google.com) (the existing `se-journey` project is fine) → APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.
   - Authorized JavaScript origins: `https://www.trackmyroadmap.com`, `http://localhost:3000`.
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback` (Supabase shows this exact URL on its Google provider page).
   - In Supabase → Authentication → Sign In / Providers → Google: turn it on, paste the client ID and secret.
4. Supabase → Authentication → URL Configuration:
   - Site URL: `https://www.trackmyroadmap.com`
   - Redirect URLs: `https://www.trackmyroadmap.com/**`, `http://localhost:3000/**`, and your Vercel preview address, e.g. `https://*.vercel.app/**`.
5. Copy the project URL and publishable key (Project Settings → API) into `.env.local`, and into Vercel's environment variables.

## Topic videos (admin)

Admins add the best YouTube video, playlist or channel for each topic at `/admin`; learners see them under the topic in their tracker (the ▶ button) and on "Up next".

1. Run the latest `supabase/schema.sql` in the SQL Editor (it creates `admins` and `topic_resources`; safe to re-run).
2. Make yourself an admin, using the email you sign in with:
   `insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';`
3. Sign in, open the account menu → **Admin · Topic videos**.

Videos attach to topic keys, so renaming a topic hides its videos; the roadmap's admin page lists them under "Not on the roadmap any more".

## Deploy on Vercel

The Vercel project builds this folder as a Next.js app (`vercel.json` sets the framework). Add the two `NEXT_PUBLIC_SUPABASE_*` environment variables under Settings → Environment Variables, then redeploy.

Progress from the original one-page site carries over automatically on any device that used it: the new app reads the same browser storage keys and uploads them to the account on first sign-in.
