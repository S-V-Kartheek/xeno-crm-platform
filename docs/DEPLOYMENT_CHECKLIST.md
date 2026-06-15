# Deployment and Submission Checklist

Use this as the Phase 5 hardening checklist before recording the walkthrough.

## Required Environment Variables

### Web

- `NEXT_PUBLIC_API_URL`: public CRM API base URL.

### CRM API

- `DATABASE_URL`: hosted PostgreSQL runtime connection string.
- `DIRECT_URL`: direct PostgreSQL connection string for Prisma migrations.
- `PORT`: API port, usually provided by the platform.
- `CORS_ORIGIN`: public frontend URL.
- `GEMINI_API_KEY`: AI provider key.
- `GEMINI_MODEL`: optional model override (`gemini-2.5-flash` default).
- `CHANNEL_SERVICE_URL`: public channel service URL.
- `CRM_CALLBACK_URL`: public CRM API URL that the channel service can call.

### Channel Service

- `CHANNEL_PORT`: port used by the service, or platform-provided `PORT`.

## Local Verification

```bash
npm install
docker compose up -d
npm run prisma:migrate
npm run seed:csv
npm run typecheck
npm run build
```

Then run the services:

```bash
npm run dev -w @smartcrm/api
npm run dev -w @smartcrm/channel
npm run dev -w @smartcrm/web
```

## End-to-End Demo Path

1. Open the web app.
2. Import `data/customers.csv`.
3. Import `data/orders.csv`.
4. Create or open a segment.
5. Create a campaign for that segment.
6. Generate AI message variants and choose/edit one.
7. Send the campaign.
8. Wait for channel callbacks.
9. Open campaign detail and verify funnel/timeline/AI retrospective.
10. Open `/insights` and verify channel, audience, and recent campaign reporting.

## Public Deployment Verification

- Frontend URL opens in incognito.
- API `/health` returns OK from public URL.
- Channel `/health` returns OK from public URL.
- Frontend can call API without CORS errors.
- API can call channel `/send`.
- Channel can call API `/receipts`.
- `/insights` shows non-empty campaign stats after a live send.
- `.env` secrets are not committed.
- Render API migrations complete successfully before first live traffic.

## Submission Links

Prepare these before recording:

- Hosted frontend URL.
- Public repository URL.
- Walkthrough video URL.

## Video Talk Track

- Product intro: shopper engagement CRM for D2C fashion.
- Functional demo: import, segment, campaign, channel callbacks, insights.
- Architecture: web/API/channel/Postgres/AI with event-log callbacks.
- Code walkthrough: `apps/api/src/insight-stats.ts`, `apps/channel/src/sender.ts`, `apps/web/src/app/insights/page.tsx`.
- AI workflow: structured outputs for segment rules, message variants, and campaign retrospectives.
