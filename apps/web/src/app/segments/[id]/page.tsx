import Link from "next/link";
import { notFound } from "next/navigation";
import { getSegment, getSegmentStats } from "@/lib/api";
import SegmentBuilder from "../SegmentBuilder";
import FunnelChart from "@/components/insights/FunnelChart";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function money(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  try {
    const segment = await getSegment(id);
    return { title: `Edit ${segment.name} | SmartCRM` };
  } catch {
    return { title: "Edit Segment | SmartCRM" };
  }
}

export default async function EditSegmentPage({ params }: Props) {
  const { id } = await params;

  let segment: Awaited<ReturnType<typeof getSegment>> | null = null;
  let stats: Awaited<ReturnType<typeof getSegmentStats>> | null = null;

  try {
    segment = await getSegment(id);
    stats = await getSegmentStats(id);
  } catch {
    notFound();
  }

  if (!segment || !stats) notFound();

  const hasCampaignStats = stats.totals.communications > 0;

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1>Edit segment</h1>
          <p className="muted">
            <Link href="/segments">← Segments</Link> &middot; Last updated{" "}
            {new Date(segment.updatedAt).toLocaleDateString("en-IN")}
          </p>
        </div>
        <div className="segment-stat-badge">
          <span className="metric">{segment.customerCount.toLocaleString("en-IN")}</span>
          <span className="muted"> current customers</span>
        </div>
      </header>

      {hasCampaignStats && (
        <section className="insight-panel segment-performance-panel">
          <div className="panel-heading">
            <div>
              <h2>Segment campaign performance</h2>
              <p>
                Aggregated across {stats.campaigns.length} campaign{stats.campaigns.length === 1 ? "" : "s"} sent to this audience.
              </p>
            </div>
            <Link href="/insights" className="btn btn-ghost btn-sm">All insights</Link>
          </div>

          <div className="insight-kpi-grid insight-kpi-grid-4">
            <div className="insight-kpi-card">
              <span>Delivery rate</span>
              <strong>{stats.rates.deliveryRate}%</strong>
              <p>{stats.totals.delivered.toLocaleString("en-IN")} delivered</p>
            </div>
            <div className="insight-kpi-card">
              <span>Open rate</span>
              <strong>{stats.rates.openRate}%</strong>
              <p>{stats.totals.opened.toLocaleString("en-IN")} opened/read</p>
            </div>
            <div className="insight-kpi-card">
              <span>Click rate</span>
              <strong>{stats.rates.clickRate}%</strong>
              <p>{stats.totals.clicked.toLocaleString("en-IN")} clicked</p>
            </div>
            <div className="insight-kpi-card revenue">
              <span>Attributed revenue</span>
              <strong>{money(stats.totals.attributedRevenue)}</strong>
              <p>{stats.totals.attributedOrders} orders</p>
            </div>
          </div>

          <FunnelChart
            deliveryRate={stats.rates.deliveryRate}
            openRate={stats.rates.openRate}
            clickRate={stats.rates.clickRate}
            conversionRate={stats.rates.conversionRate}
          />

          {stats.campaigns.length > 0 && (
            <div className="recent-campaign-list segment-campaign-list">
              {stats.campaigns.map((campaign) => (
                <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="recent-campaign-row">
                  <div>
                    <strong>{campaign.name}</strong>
                    <p>{campaign.channel.toUpperCase()} · {campaign.status}</p>
                  </div>
                  <div className="recent-campaign-rates">
                    <span>{campaign.stats.deliveryRate}% delivered</span>
                    <span>{campaign.stats.clickRate}% clicked</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <SegmentBuilder
        mode="edit"
        segmentId={segment.id}
        initialName={segment.name}
        initialDescription={segment.description ?? ""}
        initialRules={segment.rules}
      />
    </div>
  );
}
