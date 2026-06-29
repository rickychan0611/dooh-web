# DOOH Community Web

Next.js customer dashboard, public community board, player APIs, billing
webhooks, owner console, and marketing site for the DOOH Community SaaS.

## Local Development

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

The app opens at `http://localhost:3000`.

Apply the platform migrations from the parent repository before using the new
organization, billing, scheduling, community, or owner-console features:

```powershell
cd ..\..
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

## Required Services

- Supabase Auth, Postgres, and private Storage buckets
- Stripe licensed recurring prices in CAD and USD
- Resend for transactional email
- Vercel Cron for daily lifecycle and offline-screen processing

See the parent repository's `docs/setup.md` for Stripe products, webhook
events, Supabase redirects, environment variables, and deployment steps.

## Verification

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```
