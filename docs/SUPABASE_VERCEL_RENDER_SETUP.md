# Supabase + Render + Vercel Setup

This project deploys across three platforms:

- `Vercel`: `apps/web`
- `Render`: `smartcrm-api` and `smartcrm-channel`
- `Supabase`: PostgreSQL for Prisma

Use this order so each platform gets the URL it needs from the previous step.

## 1. Create Supabase Postgres

Create a Supabase project, then copy two connection strings:

- `DATABASE_URL`: pooled or runtime Postgres URL for the API
- `DIRECT_URL`: direct Postgres URL for Prisma migrations

For Prisma on hosted Postgres, keep both values pointed at the same database and include `sslmode=require` when Supabase provides it.

## 2. Deploy the Channel Service on Render

The channel service has no required custom secrets for first deploy.

1. Push `render.yaml` to your Git remote.
2. In Render, create the `smartcrm-channel` web service from the Blueprint.
3. Wait for `/health` to return OK.
4. Copy the public URL, for example `https://smartcrm-channel.onrender.com`.

## 3. Deploy the CRM API on Render

Set these environment variables on `smartcrm-api`:

- `DATABASE_URL`: Supabase runtime URL
- `DIRECT_URL`: Supabase direct URL
- `GEMINI_API_KEY`: your Gemini key
- `GEMINI_MODEL`: `gemini-2.5-flash`
- `CORS_ORIGIN`: your Vercel production URL
- `CHANNEL_SERVICE_URL`: your Render channel URL
- `CRM_CALLBACK_URL`: your Render API URL

Notes:

- `render.yaml` now runs `prisma migrate deploy` before the API starts.
- The API URL and callback URL are the same base URL; the app appends `/receipts` automatically.

## 4. Deploy the Web App on Vercel

This repo is not locally linked to Vercel yet, so link it before managing env from CLI or dashboard.

Set this Vercel environment variable:

- `NEXT_PUBLIC_API_URL`: your Render API URL

Then redeploy the Vercel project so the client bundle picks up the new value.

## 5. End-to-End URL Mapping

- `NEXT_PUBLIC_API_URL` -> `https://<smartcrm-api>.onrender.com`
- `CORS_ORIGIN` -> `https://<your-vercel-app>.vercel.app` or your custom domain
- `CHANNEL_SERVICE_URL` -> `https://<smartcrm-channel>.onrender.com`
- `CRM_CALLBACK_URL` -> `https://<smartcrm-api>.onrender.com`

## 6. First Live Verification

After all three are configured:

1. Open the Vercel web app.
2. Confirm the API health endpoint works.
3. Confirm the channel health endpoint works.
4. Import `data/customers.csv`.
5. Import `data/orders.csv`.
6. Send a test campaign.
7. Verify campaign events appear after channel callbacks.
8. Verify `/insights` shows campaign data.

## 7. Common Failure Modes

- Vercel loads but API calls fail: `NEXT_PUBLIC_API_URL` is missing or stale, then redeploy Vercel.
- Render API boots but Prisma queries fail: `DIRECT_URL` or `DATABASE_URL` is wrong, or migrations did not run.
- Campaign send fails: `CHANNEL_SERVICE_URL` is wrong or the channel service is asleep/unhealthy.
- Receipts never land: `CRM_CALLBACK_URL` is wrong or the API CORS/public URL is outdated.
- Browser CORS errors: `CORS_ORIGIN` does not exactly match the frontend origin.
