"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getCampaign,
  getCampaignInsight,
  getCampaignPerformance,
  sendCampaign,
  deleteCampaign
} from "@/lib/api";
import type { AiCampaignInsight, CampaignPerformance, CampaignSummary } from "@smartcrm/shared";
import FunnelChart from "@/components/insights/FunnelChart";
import EventTimelineChart from "@/components/insights/EventTimelineChart";

const CHANNEL_ICONS: Record<string, string> = { email: "✉️", sms: "💬", whatsapp: "📱" };

const STATUS_META: Record<string, { color: string; label: string }> = {
  draft: { color: "status-draft", label: "Draft" },
  sending: { color: "status-sending", label: "Sending..." },
  sent: { color: "status-sent", label: "Sent" },
  failed: { color: "status-failed", label: "Failed" }
};

function money(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`stat-card ${accent ? "accent" : ""}`}>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
      <div className="stat-card-label">{label}</div>
    </div>
  );
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [performance, setPerformance] = useState<CampaignPerformance | null>(null);
  const [insight, setInsight] = useState<AiCampaignInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightLoading, setInsightLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [campaignData, performanceData] = await Promise.all([
        getCampaign(id),
        getCampaignPerformance(id)
      ]);
      setCampaign(campaignData);
      setPerformance(performanceData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadInsight = useCallback(async () => {
    if (!performance || performance.stats.total === 0) return;
    setInsightLoading(true);
    try {
      setInsight(await getCampaignInsight(id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "AI insight failed");
    } finally {
      setInsightLoading(false);
    }
  }, [id, performance]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (campaign?.status !== "sending") return;
    const interval = setInterval(() => { void load(); }, 3000);
    return () => clearInterval(interval);
  }, [campaign?.status, load]);

  async function handleSend() {
    if (!campaign || campaign.status !== "draft") return;
    setSending(true);
    setActionError(null);
    try {
      await sendCampaign(id);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this draft?")) return;
    try {
      await deleteCampaign(id);
      router.push("/campaigns");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (loading) return <div className="loading-state">Loading campaign...</div>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!campaign) return <div className="error-banner">Campaign not found</div>;

  const meta = STATUS_META[campaign.status]!;
  const stats = performance?.stats ?? {
    ...campaign.stats,
    conversionRate: 0,
    attributedOrders: 0,
    attributedRevenue: 0
  };
  const hasStats = stats.total > 0;
  const issues = stats.failed + stats.bounced;

  return (
    <div className="page-campaigns">
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href="/campaigns">Campaigns</Link> / {campaign.name}
          </div>
          <h1>
            {CHANNEL_ICONS[campaign.channel]} {campaign.name}
            <span className={`campaign-status ${meta.color}`} style={{ marginLeft: "0.75rem" }}>{meta.label}</span>
          </h1>
          <p className="page-subtitle">
            Segment: <Link href={`/segments/${campaign.segmentId}`}><strong>{campaign.segmentName}</strong></Link>
            {campaign.sentAt && <> · Sent {new Date(campaign.sentAt).toLocaleString("en-IN")}</>}
          </p>
        </div>

        <div className="detail-actions">
          {campaign.status === "draft" && (
            <>
              <button className="btn btn-send" onClick={handleSend} disabled={sending}>
                {sending ? "Sending..." : "🚀 Send Campaign"}
              </button>
              <button className="btn btn-ghost btn-danger" onClick={handleDelete}>Delete Draft</button>
            </>
          )}
          {campaign.status === "sending" && <div className="pulse-badge">Delivery in progress...</div>}
        </div>
      </div>

      {actionError && <div className="error-banner">{actionError}</div>}

      {hasStats ? (
        <div className="stats-section">
          <div className="section-heading-row">
            <div>
              <h2 className="section-title">Performance funnel</h2>
              <p className="muted">Computed from channel callback events, not mocked chart data.</p>
            </div>
            <Link href="/insights" className="btn btn-ghost btn-sm">All insights</Link>
          </div>

          <div className="stats-grid stats-grid-8">
            <StatCard label="Total queued" value={stats.queued.toLocaleString("en-IN")} accent />
            <StatCard label="Sent" value={stats.sent.toLocaleString("en-IN")} />
            <StatCard label="Delivered" value={stats.delivered.toLocaleString("en-IN")} sub={`${stats.deliveryRate}%`} />
            <StatCard label="Opened/read" value={stats.opened.toLocaleString("en-IN")} sub={`${stats.openRate}%`} />
            <StatCard label="Clicked" value={stats.clicked.toLocaleString("en-IN")} sub={`${stats.clickRate}%`} />
            <StatCard label="Failed" value={stats.failed.toLocaleString("en-IN")} />
            <StatCard label="Bounced" value={stats.bounced.toLocaleString("en-IN")} />
            <StatCard
              label="Attributed revenue"
              value={money(stats.attributedRevenue)}
              sub={`${stats.attributedOrders} orders`}
            />
          </div>

          <FunnelChart
            deliveryRate={stats.deliveryRate}
            openRate={stats.openRate}
            clickRate={stats.clickRate}
            conversionRate={stats.conversionRate}
          />
        </div>
      ) : (
        <div className="empty-stats">
          <p>No delivery data yet.{campaign.status === "draft" ? " Send the campaign to start tracking." : ""}</p>
        </div>
      )}

      {hasStats && (
        <section className="campaign-insight-grid">
          <div className="ai-retro-card">
            <div className="panel-heading">
              <div>
                <h2>AI campaign retrospective</h2>
                <p>One LLM pass over the aggregate stats shown on this page.</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={loadInsight} disabled={insightLoading}>
                {insightLoading ? "Thinking..." : insight ? "Regenerate" : "Generate insight"}
              </button>
            </div>
            {insight ? (
              <>
                <p className="ai-summary">{insight.summary}</p>
                <ul className="recommendation-list">
                  {insight.recommendations.map((recommendation) => (
                    <li key={recommendation}>{recommendation}</li>
                  ))}
                </ul>
                {insight.caveats.length > 0 && (
                  <p className="insight-caveat">{insight.caveats.join(" ")}</p>
                )}
              </>
            ) : (
              <p className="muted">
                {insightLoading
                  ? "Reading the funnel..."
                  : "Click Generate insight to spend one AI request on this campaign retrospective."}
              </p>
            )}
          </div>

          <div className="attribution-card">
            <h2>Attribution heuristic</h2>
            <p>
              Orders count when a customer places a completed order within{" "}
              <strong>{performance?.attributionWindowHours ?? 48} hours</strong> after a click.
            </p>
            <div className="attribution-metrics">
              <span>{stats.attributedOrders} orders</span>
              <strong>{money(stats.attributedRevenue)}</strong>
            </div>
            {issues > 0 && (
              <p className="insight-caveat">{issues} delivery issues recorded in the event log.</p>
            )}
          </div>
        </section>
      )}

      {performance && performance.timeline.length > 0 && (
        <section className="event-timeline-section">
          <h2 className="section-title">Callback event timeline</h2>
          <EventTimelineChart data={performance.timeline} />
        </section>
      )}

      <div className="message-preview-section">
        <h2 className="section-title">Message template</h2>
        <div className="message-preview-box">
          <div className="message-preview-channel">{CHANNEL_ICONS[campaign.channel]} {campaign.channel.toUpperCase()}</div>
          <pre className="message-preview-text">{campaign.messageTemplate}</pre>
          <div className="message-preview-tokens">
            <span className="token-hint">
              Tokens: <code>{"{{name}}"}</code> → customer first name,{" "}
              <code>{"{{last_category}}"}</code> → last purchase category
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
