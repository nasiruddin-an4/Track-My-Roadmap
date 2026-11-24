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
3. Sign in with that account: you land on the admin dashboard (Overview, Users, Videos).
4. For the Overview and Users pages, add the project's **secret key** (Supabase → Project Settings → API Keys → Secret keys)
   as `SUPABASE_SECRET_KEY` in `.env` and in Vercel's environment variables. It is read on the server only; never prefix it with `NEXT_PUBLIC_`.

Videos attach to topic keys, so renaming a topic hides its videos; the roadmap's admin page lists them under "Not on the roadmap any more".

## Deploy on Vercel

The Vercel project builds this folder as a Next.js app (`vercel.json` sets the framework). Add the two `NEXT_PUBLIC_SUPABASE_*` environment variables under Settings → Environment Variables, then redeploy.

Progress from the original one-page site carries over automatically on any device that used it: the new app reads the same browser storage keys and uploads them to the account on first sign-in.

## AI Tutor

The AI Tutor page (`/ai`, linked from the navbar and a floating button on the home page) recommends roadmaps and where to start (`components/ai/AiChat.tsx`, `app/api/assistant/route.ts`, prompt in `lib/assistant/prompt.ts`, providers in `lib/assistant/providers.ts`).

1. Add one AI key to `.env` and to Vercel's environment variables (server only; never prefix with `NEXT_PUBLIC_`). Without one the page says the AI Tutor isn't switched on yet.
   - `GROQ_API_KEY` (used first if set): Groq, model `openai/gpt-oss-120b`. Groq's free tier allows only about 8,000 tokens a minute for this model, shared by every visitor, which is roughly two questions a minute; past that the tutor says it's busy. Upgrade the Groq plan before launch.
   - `ANTHROPIC_API_KEY`: Claude Opus 5.5, with the full roadmap catalogue cached between requests.
2. Run the latest `supabase/schema.sql` (it adds `assistant_usage` and `assistant_take`), with `SUPABASE_SECRET_KEY` set. That enforces the daily limits: 5 messages per guest IP, 30 per signed-in learner (`lib/assistant/limit.ts`). Until then the limit is only counted per server instance.
3. Signed-in learners' progress is read from their account, so the tutor can say where they are and suggest the next topic.

## CV Builder

`/cv` (linked from the Profile page and the account menu): ATS-friendly CVs with a live preview, PDF and Word export, CV import from PDF/DOCX, suggestions from the learner's roadmap progress, an ATS check against a job description, AI rewrites, versions and share links. Code in `components/cv/`, `lib/cv/` and `app/api/cv/`.

1. Run `supabase/cv.sql` in the SQL Editor (after `schema.sql`). It adds the `cvs` table and a private `cv-uploads` storage bucket, each limited to the owner's own rows and files. Safe to re-run.
2. For CV import, the ATS check and AI rewrites, add these to `.env` and Vercel's environment variables (server only). Without them, importing says it isn't switched on and everything else still works.
   - `ANTHROPIC_API_KEY`: Claude reads uploaded CVs. (The AI Tutor keeps using Groq first if `GROQ_API_KEY` is set.)
   - `CV_AI_MODEL`: the Claude model that reads CVs, e.g. `claude-opus-5-5`.
   - `CV_PARSE_DAILY_LIMIT` (optional, default 10): imports per learner per day, counted in `assistant_usage`.
   - `CV_AI_DAILY_LIMIT` (optional, default 30): ATS checks plus AI rewrites per learner per day. Both also have a short per-minute limit (`lib/cv/limits.ts`).
3. ATS score (`lib/cv/ats.ts`): the AI only reads keywords from the job description; matching and scoring (keywords 60, structure 25, wording 15) is plain code, so the editor recalculates it live as the CV changes.
4. Versions and sharing: a CV can be duplicated (to tailor it for another job) and one can be the primary CV, shown on the Profile page. Export as PDF or Word (`lib/cv/pdf.tsx`, `lib/cv/docx.ts`); both draw from `layoutCv()` in `lib/cv/format.ts`, as does the on-screen preview, so all three match. Share links are off by default; turning one on makes an unguessable `/cv/s/<token>` page, and turning it off (or making a new link) stops the old one working. Visitors reach a shared CV only through the `shared_cv()` database function.
5. `npm test` runs the unit tests (schema, formatting and layout, ownership filtering, upload checks, roadmap suggestions, ATS scoring).
