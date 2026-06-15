/**
 * AI Client — thin abstraction over the current AI provider.
 *
 * SWITCHING TO CLAUDE: Replace the contents of this file only.
 * 1. npm remove @google/generative-ai
 * 2. npm install @anthropic-ai/sdk --workspace=apps/api
 * 3. Change env.GEMINI_API_KEY → env.ANTHROPIC_API_KEY in env.ts
 * 4. Re-implement generateSegmentRules() and draftCampaignMessages() using
 *    Anthropic's messages.create() with tool-use (structured output).
 *    The prompt text is the same.
 *
 * Nothing else in the codebase needs to change.
 */

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { env } from "./env.js";
import { SEGMENT_SYSTEM_PROMPT, buildUserMessage } from "./prompts/segment-ai-generate.js";
import {
  CAMPAIGN_DRAFT_SYSTEM_PROMPT,
  buildCampaignDraftUserMessage
} from "./prompts/campaign-ai-draft.js";
import {
  CAMPAIGN_INSIGHT_SYSTEM_PROMPT,
  buildCampaignInsightUserMessage
} from "./prompts/campaign-insight.js";
import {
  segmentRulesSchema,
  type SegmentRules,
  type AiDraftResult,
  type AiCampaignInsight,
  type CampaignPerformance,
  type ChannelPerformance,
  type SegmentPerformance
} from "@smartcrm/shared";

// Initialise lazily so tests that don't need the AI client don't require the key.
let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return _genAI;
}

// ────────────────────────────────────────────────────────────────────────────
// Segment generation
// ────────────────────────────────────────────────────────────────────────────

// JSON schema that mirrors our SegmentRules Zod schema — Gemini uses this for
// constrained decoding so it can never return a structurally invalid response.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const segmentResponseSchema: any = {
  type: SchemaType.OBJECT,
  properties: {
    logic: {
      type: SchemaType.STRING,
      enum: ["AND", "OR"],
      description: "How to combine conditions — AND or OR"
    },
    conditions: {
      type: SchemaType.ARRAY,
      description: "List of filter conditions",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          field: { type: SchemaType.STRING, description: "Customer field to filter on" },
          operator: { type: SchemaType.STRING, description: "Comparison operator" },
          value: {
            type: SchemaType.STRING,
            description: "Value to compare against (numbers and arrays encoded as strings)"
          }
        },
        required: ["field", "operator", "value"]
      }
    }
  },
  required: ["logic", "conditions"]
};

export type AiGenerateResult =
  | { ok: true; rules: SegmentRules }
  | { ok: false; error: string };

/**
 * Call the AI to translate a natural-language prompt into validated SegmentRules.
 * Always returns a discriminated union — never throws.
 */
export async function generateSegmentRules(naturalLanguage: string): Promise<AiGenerateResult> {
  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SEGMENT_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: segmentResponseSchema
      }
    });

    const result = await model.generateContent(buildUserMessage(naturalLanguage));
    const text = result.response.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: "AI returned malformed JSON — please try again or build manually." };
    }

    const validation = segmentRulesSchema.safeParse(parsed);
    if (!validation.success) {
      const detail = validation.error.issues.map((i) => i.message).join("; ");
      return { ok: false, error: `AI rules failed validation: ${detail}` };
    }

    return { ok: true, rules: validation.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI error";
    return { ok: false, error: `AI request failed: ${message}` };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Campaign message drafting
// ────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const campaignDraftSchema: any = {
  type: SchemaType.OBJECT,
  properties: {
    variants: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          tone: { type: SchemaType.STRING, enum: ["friendly", "urgency"] },
          label: { type: SchemaType.STRING },
          message: { type: SchemaType.STRING }
        },
        required: ["tone", "label", "message"]
      }
    }
  },
  required: ["variants"]
};

export type AiDraftCampaignResult =
  | { ok: true; result: AiDraftResult }
  | { ok: false; error: string };

/**
 * Generate 2 campaign message variants (friendly + urgency) for a segment.
 * Always returns a discriminated union — never throws.
 */
export async function draftCampaignMessages(
  segmentName: string,
  channel: string,
  customerCount: number
): Promise<AiDraftCampaignResult> {
  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: CAMPAIGN_DRAFT_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: campaignDraftSchema
      }
    });

    const result = await model.generateContent(
      buildCampaignDraftUserMessage(segmentName, channel, customerCount)
    );
    const text = result.response.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: "AI returned malformed JSON for campaign draft." };
    }

    // Basic structural validation
    const raw = parsed as { variants?: unknown[] };
    if (!raw.variants || !Array.isArray(raw.variants) || raw.variants.length < 2) {
      return { ok: false, error: "AI did not return 2 message variants." };
    }

    return {
      ok: true,
      result: {
        variants: [raw.variants[0], raw.variants[1]] as AiDraftResult["variants"]
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI error";
    return { ok: false, error: `AI draft failed: ${message}` };
  }
}

// ─── Campaign performance insight ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const campaignInsightSchema: any = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING },
    recommendations: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING }
    },
    caveats: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING }
    }
  },
  required: ["summary", "recommendations", "caveats"]
};

export type AiCampaignInsightResult =
  | { ok: true; result: AiCampaignInsight }
  | { ok: false; error: string; fallback: AiCampaignInsight };

function fallbackCampaignInsight(campaign: CampaignPerformance): AiCampaignInsight {
  const { stats } = campaign;
  const summary =
    stats.total === 0
      ? `${campaign.campaignName} has not generated delivery events yet, so performance is still settling.`
      : `${campaign.campaignName} reached ${stats.total.toLocaleString("en-IN")} shoppers in ${campaign.segmentName}, with ${stats.deliveryRate}% delivered, ${stats.openRate}% opened, and ${stats.clickRate}% clicked.`;

  const recommendations = [
    stats.clickRate >= 20
      ? "Reuse this audience-message pairing for a follow-up campaign while intent is warm."
      : "Test a sharper offer or stronger creative hook before scaling this audience.",
    stats.deliveryRate < 85
      ? "Review channel quality and contact hygiene because delivery is the biggest leak in this funnel."
      : "Delivery is healthy; optimize the open-to-click step next."
  ];

  const caveats = [
    stats.total < 30
      ? "Sample size is small, so treat this as directional rather than conclusive."
      : `Attribution uses a simple ${campaign.attributionWindowHours}h post-click order window.`
  ];

  return { summary, recommendations, caveats };
}

export async function summarizeCampaignInsight(
  campaign: CampaignPerformance,
  channelBenchmarks: ChannelPerformance[],
  segmentBenchmarks: SegmentPerformance[]
): Promise<AiCampaignInsightResult> {
  const fallback = fallbackCampaignInsight(campaign);

  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: CAMPAIGN_INSIGHT_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: campaignInsightSchema
      }
    });

    const result = await model.generateContent(
      buildCampaignInsightUserMessage(campaign, channelBenchmarks, segmentBenchmarks)
    );
    const text = result.response.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: "AI returned malformed insight JSON.", fallback };
    }

    const raw = parsed as Partial<AiCampaignInsight>;
    if (
      typeof raw.summary !== "string" ||
      !Array.isArray(raw.recommendations) ||
      !Array.isArray(raw.caveats)
    ) {
      return { ok: false, error: "AI insight failed structural validation.", fallback };
    }

    return {
      ok: true,
      result: {
        summary: raw.summary,
        recommendations: raw.recommendations.slice(0, 3).map(String),
        caveats: raw.caveats.slice(0, 2).map(String)
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI error";
    return { ok: false, error: `AI insight failed: ${message}`, fallback };
  }
}
