"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getCampaigns, deleteCampaign } from "@/lib/api";
import type { CampaignSummary } from "@smartcrm/shared";

const CHANNEL_ICONS: Record<string, string> = {
  email: "✉️",
  sms: "💬",
  whatsapp: "📱"
};

const STATUS_COLORS: Record<string, string> = {
  draft: "status-draft",
  sending: "status-sending",
  sent: "status-sent",
  failed: "status-failed"
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getCampaigns();
      setCampaigns(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Auto-refresh every 5s while any campaign is in "sending" state
  useEffect(() => {
    const hasSending = campaigns.some(c => c.status === "sending");
    if (!hasSending) return;
    const id = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(id);
  }, [campaigns, load]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this draft campaign?")) return;
    try {
      setDeleting(id);
      await deleteCampaign(id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="page-campaigns">
      <div className="page-header">
        <div>
          <h1>Campaigns</h1>
          <p className="page-subtitle">Create, manage, and track outreach campaigns for your segments.</p>
        </div>
        <Link href="/campaigns/new" className="btn btn-primary">+ New Campaign</Link>
      </div>

      {loading && <div className="loading-state">Loading campaigns…</div>}
      {error && <div className="error-banner">{error}</div>}

      {!loading && campaigns.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📣</div>
          <h3>No campaigns yet</h3>
          <p>Create your first campaign to start reaching your customers.</p>
          <Link href="/campaigns/new" className="btn btn-primary">Create Campaign</Link>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="campaign-grid">
          {campaigns.map(campaign => (
            <div key={campaign.id} className="campaign-card">
              <div className="campaign-card-header">
                <div className="campaign-meta">
                  <span className="campaign-channel">{CHANNEL_ICONS[campaign.channel]} {campaign.channel.toUpperCase()}</span>
                  <span className={`campaign-status ${STATUS_COLORS[campaign.status]}`}>{campaign.status}</span>
                </div>
                <h3 className="campaign-name">{campaign.name}</h3>
                <p className="campaign-segment">Segment: <strong>{campaign.segmentName}</strong></p>
              </div>

              {campaign.stats.total > 0 && (
                <div className="campaign-stats">
                  <div className="stat-row">
                    <span className="stat-label">Sent</span>
                    <span className="stat-value">{campaign.stats.total.toLocaleString()}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Delivered</span>
                    <span className="stat-value">{campaign.stats.delivered.toLocaleString()} <em>{campaign.stats.deliveryRate}%</em></span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Opened</span>
                    <span className="stat-value">{campaign.stats.opened.toLocaleString()} <em>{campaign.stats.openRate}%</em></span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Clicked</span>
                    <span className="stat-value">{campaign.stats.clicked.toLocaleString()} <em>{campaign.stats.clickRate}%</em></span>
                  </div>

                  {/* Progress bar */}
                  <div className="delivery-bar">
                    <div className="delivery-bar-fill" style={{ width: `${campaign.stats.deliveryRate}%` }} />
                  </div>
                </div>
              )}

              <div className="campaign-card-footer">
                <span className="campaign-date">
                  {campaign.sentAt
                    ? `Sent ${new Date(campaign.sentAt).toLocaleDateString("en-IN")}`
                    : `Created ${new Date(campaign.createdAt).toLocaleDateString("en-IN")}`}
                </span>
                <div className="campaign-actions">
                  <Link href={`/campaigns/${campaign.id}`} className="btn btn-ghost btn-sm">View</Link>
                  {campaign.status === "draft" && (
                    <button
                      className="btn btn-ghost btn-sm btn-danger"
                      onClick={() => handleDelete(campaign.id)}
                      disabled={deleting === campaign.id}
                    >
                      {deleting === campaign.id ? "…" : "Delete"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
