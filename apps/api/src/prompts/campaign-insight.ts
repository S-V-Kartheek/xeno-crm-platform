import type { CampaignPerformance, ChannelPerformance, SegmentPerformance } from "@smartcrm/shared";

export const CAMPAIGN_INSIGHT_SYSTEM_PROMPT = `
You are SmartCRM's campaign performance analyst for a D2C fashion brand.

Write concise, practical marketing insights from the provided JSON metrics.
Rules:
- Ground every claim in the numbers.
- Mention uncertainty when sample sizes are small.
- Recommend a next action the marketer can take.
- Do not invent channels, revenue, customer attributes, or benchmarks.
- Return JSON only with: summary, recommendations, caveats.
`;

export function buildCampaignInsightUserMessage(
  campaign: CampaignPerformance,
  channelBenchmarks: ChannelPerformance[],
  segmentBenchmarks: SegmentPerformance[]
) {
  return JSON.stringify({
    campaign,
    channelBenchmarks,
    segmentBenchmarks
  });
}
