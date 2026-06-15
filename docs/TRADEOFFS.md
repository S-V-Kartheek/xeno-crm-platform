# Tradeoffs and Scope Decisions

This document is meant to make the build choices explicit for Xeno reviewers.

## What I Built

- D2C fashion CRM, not a sales/support CRM.
- Customer and order ingestion through CRUD and CSV import.
- Rule-based segmentation with AI natural-language rule generation.
- Campaign creation with AI message drafting and human edit/approval.
- Separate callback-driven channel simulator.
- Campaign, segment, and global insights dashboard.
- AI campaign retrospectives grounded in aggregate stats.
- Growth intelligence layer with transparent heuristics for health scoring, next-best actions, and audience opportunities.

## What I Intentionally Did Not Build

- Real WhatsApp/SMS/email provider integration: the assignment asks for a stubbed channel service.
- Full attribution modeling: implemented a simple 48-hour post-click completed-order heuristic.
- Multi-user auth/roles: not central to the Xeno problem statement and would dilute campaign/insight depth.
- Durable queue infrastructure: in-process timers are enough for the demo; production would use a queue.
- Complex recursive segment logic: current rules stay understandable and editable for marketers.

## AI-Native Product Choices

- AI is a translator and analyst, not a hidden source of truth.
- Segment AI returns explicit editable rules.
- Campaign AI returns message variants that the marketer can choose and edit.
- Insight AI receives real aggregate JSON and returns summaries, recommendations, and caveats.
- Growth recommendations are rule-based and explainable so recruiters can inspect every assumption instead of trusting a black box.

## System Design Choices

- PostgreSQL is the source of truth because segment rules, event logs, and reporting need relational queries.
- `CommunicationEvent` is append-only so the lifecycle is auditable.
- `Communication.status` is denormalized because list pages should not recompute latest status repeatedly.
- Shared TypeScript/Zod contracts keep API and UI response shapes aligned.

## If I Had More Time

- Add retries/dead-letter handling for channel callbacks.
- Add authenticated brand workspaces.
- Cache insight summaries per campaign once communications settle.
- Add seed scripts that import directly into hosted Postgres.
- Add Playwright smoke tests for the send-to-insights loop.
