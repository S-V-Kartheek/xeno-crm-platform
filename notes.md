Project scope: AI-native Mini CRM for a D2C fashion brand — ingestion, segmentation, AI-assisted campaigns, two-service channel/callback architecture, insights dashboard.

Target audience: Xeno engineering evaluators (SDE/FDE hiring panel) — assessing build quality, AI-native workflow, system design reasoning, and product scoping.

Constraints:  solo build, AI-tool-assisted development, free-tier hosting only.

Tech ecosystem: Next.js + TypeScript + Node/Express + PostgreSQL + Claude/OpenAI API — chosen for deploy speed, AI-tool fluency, and clean separation into two repos as the spec implies.

Phase 0 — Setup & Foundation 
Objectives

Stand up both repos, provision DB, lock the data model, seed realistic fashion data.
Wow feature(s)

A seed data generator script that produces seasonally-clustered, category-diverse orders (not flat-random) — this is what makes every later screen look "real" instead of like a toy demo. Small effort, disproportionate visual payoff.

Careful considerations

Decide the two-repo split now (CRM backend vs channel service) — restructuring mid-week costs hours you don't have.
Lock the schema before building UI on top of it. Schema churn on day 4 is the single biggest time-sink risk in this kind of project.
Don't over-model attributes. 4-5 customer attributes (city, signup date, category_affinity, AOV tier) is enough — more becomes noise in segmentation later.

Tech stack

Frontend: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
Backend: Node.js + Express + TypeScript (separate repo)
Database: PostgreSQL via Supabase or Neon (free tier, instant provisioning)
Hosting: not yet — local dev only this phase
DevOps/Tools: GitHub (two repos created day 1), Prisma or Drizzle ORM for schema + migrations
Tools: Claude/Cursor for scaffolding boilerplate + seed script generation



Risk: Spending too long on "perfect" schema design — timebox to 90 minutes, iterate later if needed.

Phase 1 — Data Ingestion & Core CRUD 
Objectives

Customer and order ingestion APIs, basic listing/detail views, foundational backend structure.
Wow feature(s)

Bulk CSV import endpoint for customers/orders, with a simple validation + error report on bad rows. Signals "real ingestion pipeline" thinking rather than just a form that adds one row at a time — directly maps to the spec's "Ingest data — take in customers and their orders."

Careful considerations

Build the customer/order list views with pagination from the start — even with ~100 records, an unpaginated table looks unfinished next to a "production-level thinking" claim.
Use the bulk import to load your own seeded dataset — this doubles as your seed mechanism and a demoable feature.
Keep API responses typed and consistent (shared types file or OpenAPI-lite) — this is what "code quality & structure" reviewers notice fastest when skimming.

Tech stack

Frontend: Next.js pages for customer list/detail, order list — Tailwind + shadcn table components
Backend: Express routes (/customers, /orders, /import), Zod for request validation
Database: PostgreSQL — customers, orders tables live
Hosting: still local; deploy a "hello world" version of frontend+backend to Vercel/Render to catch deploy issues early (don't wait until day 6)
DevOps/Tools: Postman/Thunder Client for API testing, ESLint+Prettier configured now (cheap, signals discipline)


Risk: Skipping the early "hello world" deploy is the most common cause of last-day deployment panic — do it now even if it's bare.

Phase 2 — Segmentation Engine 
Objectives

Rule-based segment builder (the foundation) + AI natural-language-to-segment layer on top.
Wow feature(s)

"Show your work" AI segmentation: marketer types "customers who bought summer collection but haven't ordered in 60 days," AI translates it into explicit, editable filter rules displayed transparently (not a black box), and shows a live customer count before saving. This is your single highest-leverage AI-native feature — it's cheap to build (one structured-output LLM call + your existing filter engine) but reads as deeply "AI-native" in the demo and directly answers the "AI-native development" and "explainability" criteria.

Careful considerations

Build the rule-based engine first, fully working, before adding the AI layer on top — the AI is a translation layer over real logic, not a replacement for it. This is the distinction Xeno explicitly cares about ("how you direct, review, and integrate AI output").
Use structured outputs (JSON mode / tool-use) for the NL→rules call — free-text parsing will break unpredictably during your live demo.
Cap segment complexity (AND/OR, 2 levels) — a fully recursive rule-builder UI is a rabbit hole that doesn't add proportional score.

Tech stack

Frontend: Segment builder UI (condition rows, AND/OR toggles) + AI prompt input box + live count preview
Backend: /segments CRUD, /segments/preview (returns matching customer count + sample), /segments/ai-generate (calls LLM)
AI: Claude API (Sonnet) with tool-use/structured output for rules JSON
Database: segments table (rules stored as JSONB, created_via: manual | ai_generated)
Hosting: redeploy current state to catch any new env-var/API-key issues with the AI integration
DevOps/Tools: store LLM prompts in a /prompts folder in the repo — doubles as documentation for your "AI workflow" video section


Risk: LLM occasionally returns malformed JSON — always validate with Zod and have a clear fallback (show error, let user retry or build manually) rather than crashing the UI.

Phase 3 — Campaign Creation, AI Message Drafting & Channel Service 
Objectives

Campaign creation flow + AI-drafted messages + the genuinely separate channel service with the send→callback loop.
Wow feature(s)

The two-service callback loop, done properly (separate deployed service, async delay, multi-stage receipts: delivered → opened → clicked over time, idempotent updates). This is the single highest-stakes deliverable in the entire spec — it's explicitly detailed, which means weak implementations are the easiest for evaluators to spot. Doing this correctly is your biggest differentiator from candidates who fake it with a setTimeout writing directly to the DB.
AI message drafting with personalization tokens, generating 2 tone variants (e.g., "friendly nudge" vs "urgency/discount") that the marketer picks between before sending.

Careful considerations

Channel service must be a separate deployable unit — even if it's a small Express app, it needs its own repo/folder and its own deployment target. This separateness is itself a signal evaluators are likely checking for.
Model the communications table as an event log (status_history), not a single overwritable status field — without this, your "lifecycle" claim in the video has no data behind it.
Explicitly handle: idempotent receipt processing (same receipt twice ≠ double count), and have a one-sentence answer ready for "what if a receipt never arrives" (timeout + retry — even if not fully implemented, articulate the design).
Don't let AI message drafting block the send flow — always allow manual edit/override before send (keeps a human in the loop, a defensible product stance).

Tech stack

Frontend: Campaign creation wizard (select segment → channel → AI draft → review/edit → send), campaign list view
Backend (CRM): /campaigns CRUD, /campaigns/:id/send (creates communications rows, calls channel service), /receipts (idempotent webhook handler)
Channel service (separate repo/deploy): /send endpoint (returns 202, schedules simulated outcome via delayed job), calls back to CRM /receipts
AI: Claude API for message drafting (2 variants, personalization tokens like {{name}}, {{last_category}})
Database: campaigns, communications, communication_events (event log) tables
Hosting: deploy channel service to Render/Railway as its own service now — don't defer this
DevOps/Tools: optional BullMQ + Upstash Redis for the delayed-callback queue (impressive if time allows; in-memory setTimeout + clear "in production I'd use a queue" note is an acceptable fallback)

 — this is the riskiest, highest-value phase; protect this time block

Risk: This phase is the most likely to overrun. If behind schedule by end of Day 4, cut Phase 2's AI segmentation polish (keep rule-based working) before cutting any part of this phase — the callback loop is non-negotiable per the spec's emphasis.

Phase 4 — Insights Dashboard & AI Performance Summaries 
Objectives

Campaign/segment-level stats dashboard + AI-generated natural-language insights.
Wow feature(s)

AI campaign retrospective: after a campaign's communications settle, one LLM call over aggregated stats produces a 2-3 sentence insight ("This segment responded 2x better to WhatsApp than Email for this campaign — consider shifting future sends to WhatsApp for similar audiences"). Cheap to build, but it's the feature that makes the whole product feel like it's thinking, not just reporting — directly hits "AI-native development" again in a second, distinct way from Phase 2's segmentation.

Careful considerations

Aggregate stats (sent/delivered/failed/opened/read/clicked + rates) at both campaign and segment level — the spec explicitly lists both.
Keep the AI insight as a supplement to real numbers shown on screen, not a replacement — evaluators should be able to see the data the AI is reasoning over.
Order-attribution ("order came because of this communication") — implement as a simple heuristic only (order within 24-48h of a click, tagged to campaign); don't build real attribution modeling, it's explicitly low-priority per your scoping.

Tech stack

Frontend: Dashboard with stat cards + simple charts (Recharts), per-campaign drill-down view, AI insight callout box
Backend: /campaigns/:id/stats (aggregation query), /campaigns/:id/insight (LLM call over stats)
AI: Claude API, single-shot prompt over a small JSON stats object
Database: read-heavy aggregation queries over communications/communication_events — add indexes on campaign_id, status now if not already present
Hosting: redeploy, sanity-check chart rendering on deployed build (chart libraries occasionally behave differently in prod builds)


Risk: Aggregation queries can get slow if not indexed — with realistic data volumes (a few hundred communications) this won't bite you, but add the indexes anyway as a "scale tradeoff" talking point for the interview.

Phase 5 — Polish, Deployment Hardening & Documentation 
Objectives

End-to-end testing on deployed URLs, README, architecture diagram in repo, ADR-style tradeoffs note.
Wow feature(s)

A one-page "what I built, what I didn't, and why" doc (ADR-style) in the repo root — directly mirrors Xeno's "make your tradeoffs explicit" instruction and pre-answers half the likely interview questions before they're asked. This is disproportionately high-leverage for almost no build time.

Careful considerations

Test the full loop on the deployed URLs, not localhost — send a real campaign on the live frontend and verify the live channel service calls back to the live backend and the live dashboard updates. Localhost-only testing is the #1 way a working local build fails silently in production.
Verify every link (frontend, both repos, video once recorded) is publicly accessible from an incognito window.
Confirm the deployed app has seed data loaded — an empty CRM on submission day is a real, common failure.
Light visual polish pass (spacing, empty states, loading states) — shadcn/Tailwind defaults already look clean, so this should be quick, not a redesign.

Tech stack

Frontend/Backend/Channel service: no new stack — this phase is testing + docs + config
Hosting: final deploy verification across Vercel (frontend) + Render/Railway (CRM backend + channel service) + Supabase/Neon (DB)
DevOps/Tools: .env.example files in both repos (no secrets committed), architecture diagram (the one from earlier in this conversation) embedded in README
Tools: incognito-window checklist, a second device/browser for the public-access test


Risk: If deployment issues surface here that require code changes (e.g., CORS between separately-hosted frontend/backend, env var mismatches), this can eat into Phase 6 — keep Phase 6 lightly buffered.

Phase 6 — Walkthrough Video & Final Submission 
Objectives

Record the 5-6 minute walkthrough following the suggested structure, final submission checks.
Wow feature(s)

A scripted, timed video that explicitly narrates tradeoffs in real time ("I chose to model communications as an event log rather than a single status field, because...") — this is what separates a "feature tour" video from one that demonstrates "thought clarity & communication," which is its own scored criterion.

Careful considerations

Script and time each section before recording — 5-6 minutes is tight, and unscripted demos reliably overrun (Product intro 0.5 min, Functional demo 1.5 min, Architecture 1 min, Code walkthrough 1 min, AI workflow 1 min, leaves ~1 min buffer).
Record the functional demo on the deployed product, not localhost — consistent with everything else, and shows the "build & deploy" baseline is real.
For the AI-workflow section, reference your /prompts folder from Phase 2 and the ADR doc from Phase 5 — concrete artifacts beat vague claims of "I used AI a lot."
Submit a day early if your timeline allows slack — but given the full 7 days are accounted for here, submit the moment everything passes the Phase 5 checklist; don't add new features on submission day.

Tech stack

Tools: Loom or OBS for recording, simple slide/diagram for the architecture section (reuse the diagrams already built), submission form (per the email — frontend URL, both repo links, video link)

Estimate: Half day for recording/editing, half day buffer for re-records or last-minute fixes

Risk: Re-recording due to a live bug discovered on camera — this is exactly why Phase 5's full-deployed-loop test must happen before this phase, not during it.