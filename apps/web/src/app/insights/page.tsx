import Link from "next/link";
import { getInsightsDashboard } from "@/lib/api";
import ChannelPerformanceChart from "@/components/insights/ChannelPerformanceChart";
import SegmentLeaderboardChart from "@/components/insights/SegmentLeaderboardChart";

export const dynamic = "force-dynamic";

function money(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export default async function InsightsPage() {
  let dashboard;
  let error: string | null = null;

  try {
    dashboard = await getInsightsDashboard();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load insights";
  }

  if (error || !dashboard) {
    return (
      <div className="stack">
        <header className="page-header">
          <div>
            <h1>Insights</h1>
            <p className="muted">Campaign performance intelligence for your shopper audiences.</p>
          </div>
        </header>
        <div className="card error">Insights unavailable: {error}</div>
      </div>
    );
  }

  const issueRate = dashboard.totals.communications > 0
    ? Math.round(((dashboard.totals.failed + dashboard.totals.bounced) / dashboard.totals.communications) * 100)
    : 0;
  const intelligence = dashboard.growthIntelligence;

  return (
    <div className="page-insights">
      <header className="insights-hero">
        <div>
          <span className="eyebrow">Phase 4 Intelligence Layer</span>
          <h1>Performance Insights</h1>
          <p>
            Event-log driven reporting across campaigns, audiences, channels, and post-click
            revenue attribution.
          </p>
        </div>
        <Link href="/campaigns/new" className="btn btn-primary">Launch Campaign</Link>
      </header>

      <section className="insight-kpi-grid insight-kpi-grid-6">
        <div className="insight-kpi-card accent">
          <span>Total reach</span>
          <strong>{dashboard.totals.communications.toLocaleString("en-IN")}</strong>
          <p>{dashboard.totals.campaigns} campaigns · {dashboard.totals.sent.toLocaleString("en-IN")} sent</p>
        </div>
        <div className="insight-kpi-card">
          <span>Delivery rate</span>
          <strong>{dashboard.rates.deliveryRate}%</strong>
          <p>{dashboard.totals.delivered.toLocaleString("en-IN")} delivered</p>
        </div>
        <div className="insight-kpi-card">
          <span>Open rate</span>
          <strong>{dashboard.rates.openRate}%</strong>
          <p>{dashboard.totals.opened.toLocaleString("en-IN")} opened/read</p>
        </div>
        <div className="insight-kpi-card">
          <span>Click rate</span>
          <strong>{dashboard.rates.clickRate}%</strong>
          <p>{dashboard.totals.clicked.toLocaleString("en-IN")} shoppers clicked</p>
        </div>
        <div className="insight-kpi-card">
          <span>Delivery issues</span>
          <strong>{issueRate}%</strong>
          <p>{dashboard.totals.failed + dashboard.totals.bounced} failed/bounced</p>
        </div>
        <div className="insight-kpi-card revenue">
          <span>Attributed revenue</span>
          <strong>{money(dashboard.totals.attributedRevenue)}</strong>
          <p>{dashboard.totals.attributedOrders} post-click orders</p>
        </div>
      </section>

      <section className="growth-command-center">
        <div className="growth-brief-card">
          <div className="growth-score-ring">
            <strong>{intelligence.healthScore || "—"}</strong>
            <span>/100</span>
          </div>
          <div>
            <span className="eyebrow">Executive Decision Brief</span>
            <h2>{intelligence.healthLabel}</h2>
            <p>{intelligence.executiveSummary}</p>
          </div>
        </div>

        <div className="next-action-panel">
          <h3>Next best actions</h3>
          <div className="next-action-list">
            {intelligence.nextBestActions.map((action) => (
              <div key={action.id} className="next-action-card">
                <div>
                  <strong>{action.title}</strong>
                  <p>{action.rationale}</p>
                </div>
                <div className="action-tags">
                  <span className={`impact-${action.impact}`}>{action.impact} impact</span>
                  <span>{action.effort} effort</span>
                  <span>{action.ownerHint}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="insight-panel">
        <div className="panel-heading">
          <div>
            <h2>Smart growth opportunities</h2>
            <p>Auto-detected audience plays from customer value, recency, orders, and channel performance.</p>
          </div>
        </div>
        {intelligence.opportunities.length === 0 ? (
          <p className="muted">Import more orders or send campaigns to unlock opportunity detection.</p>
        ) : (
          <div className="opportunity-grid">
            {intelligence.opportunities.map((opportunity) => (
              <article key={opportunity.id} className="opportunity-card">
                <div className="opportunity-card-top">
                  <span className="priority-pill">P{opportunity.priority}</span>
                  <span>{opportunity.confidence} confidence</span>
                </div>
                <h3>{opportunity.title}</h3>
                <p>{opportunity.description}</p>
                <div className="opportunity-metrics">
                  <div>
                    <span>Audience</span>
                    <strong>{opportunity.audienceSize.toLocaleString("en-IN")}</strong>
                  </div>
                  <div>
                    <span>Upside</span>
                    <strong>{money(opportunity.estimatedRevenue)}</strong>
                  </div>
                  <div>
                    <span>Channel</span>
                    <strong>{opportunity.suggestedChannel.toUpperCase()}</strong>
                  </div>
                </div>
                <p className="playbook">{opportunity.playbook}</p>
                <div className="rules-preview">
                  {opportunity.rulesPreview.map((rule) => (
                    <code key={rule}>{rule}</code>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="insights-grid">
        <div className="insight-panel">
          <div className="panel-heading">
            <div>
              <h2>Channel intelligence</h2>
              <p>Delivery, open, and click rates by channel — from callback events.</p>
            </div>
          </div>
          {dashboard.channelPerformance.length === 0 ? (
            <p className="muted">Send a campaign to compare channels.</p>
          ) : (
            <ChannelPerformanceChart data={dashboard.channelPerformance} />
          )}
        </div>

        <div className="insight-panel ai-panel">
          <div className="panel-heading">
            <div>
              <h2>Performance recommendations</h2>
              <p>Rule-based signals from the same aggregates shown in the charts.</p>
            </div>
          </div>
          <ul className="recommendation-list">
            {dashboard.recommendations.map((recommendation) => (
              <li key={recommendation}>{recommendation}</li>
            ))}
          </ul>
          <p className="insight-caveat">
            Per-campaign AI retrospectives are available on each campaign detail page after events settle.
          </p>
        </div>
      </section>

      <section className="insights-grid">
        <div className="insight-panel">
          <div className="panel-heading">
            <div>
              <h2>Audience leaderboard</h2>
              <p>Segments ranked by click rate across all campaigns.</p>
            </div>
          </div>
          {dashboard.segmentPerformance.length === 0 ? (
            <p className="muted">No segment performance yet.</p>
          ) : (
            <>
              <SegmentLeaderboardChart data={dashboard.segmentPerformance} />
              <div className="segment-leaderboard segment-leaderboard-compact">
                {dashboard.segmentPerformance.map((segment, index) => (
                  <div key={segment.segmentId} className="segment-rank-row">
                    <span className="rank-badge">#{index + 1}</span>
                    <div>
                      <Link href={`/segments/${segment.segmentId}`}>{segment.segmentName}</Link>
                      <p>
                        {segment.total.toLocaleString("en-IN")} sends · {segment.deliveryRate}% delivered ·{" "}
                        {money(segment.attributedRevenue)} attributed
                      </p>
                    </div>
                    <strong>{segment.clickRate}%</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="insight-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent campaign pulse</h2>
              <p>Fast drill-down into the latest campaign funnels.</p>
            </div>
          </div>
          <div className="recent-campaign-list">
            {dashboard.recentCampaigns.length === 0 ? (
              <p className="muted">No campaigns sent yet.</p>
            ) : (
              dashboard.recentCampaigns.map((campaign) => (
                <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="recent-campaign-row">
                  <div>
                    <strong>{campaign.name}</strong>
                    <p>{campaign.segmentName} · {campaign.channel.toUpperCase()}</p>
                  </div>
                  <div className="recent-campaign-rates">
                    <span>{campaign.stats.deliveryRate}% delivered</span>
                    <span>{campaign.stats.openRate}% opened</span>
                    <span>{campaign.stats.clickRate}% clicked</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
