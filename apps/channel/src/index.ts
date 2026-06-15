/**
 * Channel Service — SmartCRM
 *
 * A separate Express app that simulates message delivery and fires async
 * callbacks back to the CRM. This is deliberately a separate process/port
 * to satisfy the "two-service architecture" requirement.
 *
 * Port: 4001 (CRM API is on 4000)
 *
 * Routes:
 *   GET  /health  — liveness probe
 *   POST /send    — accept a message batch, return 202 immediately,
 *                   simulate delivery in background, POST receipts to CRM
 */

import express from "express";
import cors from "cors";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, config } from "dotenv";

// Load env — try local first, then monorepo root
config({ path: join(process.cwd(), ".env"), override: true });
config({ path: join(process.cwd(), "..", "..", ".env"), override: true });

// Direct fs read to bypass dotenv vault (same fix as CRM API)
try {
  const rootEnvPath = join(process.cwd(), "..", "..", ".env");
  const raw = readFileSync(rootEnvPath, "utf8");
  const parsed = parse(raw);
  for (const [key, value] of Object.entries(parsed)) {
    process.env[key] = value;
  }
} catch { /* root .env may not exist */ }

import { processBatch } from "./sender.js";

const PORT = Number(process.env.PORT ?? process.env.CHANNEL_PORT ?? 4001);
const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// ── Health ────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "smartcrm-channel", port: PORT });
});

// ── POST /send ────────────────────────────────────────────────
app.post("/send", (req, res) => {
  const body = req.body as {
    campaignId?: string;
    channel?: string;
    callbackUrl?: string;
    messages?: unknown[];
  };

  if (!body.campaignId || !body.channel || !body.callbackUrl || !Array.isArray(body.messages)) {
    res.status(400).json({ error: "Missing required fields: campaignId, channel, callbackUrl, messages" });
    return;
  }

  if (body.messages.length === 0) {
    res.status(400).json({ error: "messages array is empty" });
    return;
  }

  // Return 202 immediately — processing is async
  res.status(202).json({
    accepted: true,
    campaignId: body.campaignId,
    messageCount: body.messages.length
  });

  // Fire and forget — runs in background
  processBatch({
    campaignId: body.campaignId,
    channel: body.channel,
    callbackUrl: body.callbackUrl,
    messages: body.messages as Parameters<typeof processBatch>[0]["messages"]
  });
});

app.listen(PORT, () => {
  console.log(`SmartCRM Channel Service listening on http://localhost:${PORT}`);
});
