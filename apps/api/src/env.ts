import { join } from "node:path";
import { readFileSync } from "node:fs";
import { config, parse } from "dotenv";

// Use override:true so the .env file on disk always wins over any dotenv vault cache.
config({ path: join(process.cwd(), ".env"), override: true });
config({ path: join(process.cwd(), "..", "..", ".env"), override: true });

// Extra safety: directly read & parse the root .env with fs so vault cannot intercept.
try {
  const rootEnvPath = join(process.cwd(), "..", "..", ".env");
  const raw = readFileSync(rootEnvPath, "utf8");
  const parsed = parse(raw);
  for (const [key, value] of Object.entries(parsed)) {
    process.env[key] = value; // hard-set, bypasses vault
  }
} catch {
  // root .env may not exist in some environments — that's fine
}
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  // AI provider — Gemini API Key
  GEMINI_API_KEY: z.string().min(1),
  // Channel service — separate Express app on port 4001
  CHANNEL_SERVICE_URL: z.string().default("http://localhost:4001"),
  // URL the channel service will call back to with delivery receipts
  CRM_CALLBACK_URL: z.string().default("http://localhost:4000")
});

export const env = envSchema.parse(process.env);
