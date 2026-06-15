import Link from "next/link";
import { getCustomers, getOrders, getSegments, getInsightsDashboard } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let customerCount = 0;
  let orderCount = 0;
  let segmentCount = 0;
  let campaignCount = 0;
  let attributedRevenue = 0;
  let apiError: string | null = null;

  try {
    const [customers, orders, segments, insights] = await Promise.all([
      getCustomers(1),
      getOrders(1),
      getSegments(),
      getInsightsDashboard()
    ]);
    customerCount = customers.meta.total;
    orderCount = orders.meta.total;
    segmentCount = segments.meta.total;
    campaignCount = insights.totals.campaigns;
    attributedRevenue = insights.totals.attributedRevenue;
  } catch (error) {
    apiError = error instanceof Error ? error.message : "API unavailable";
  }

  const stats = [
    {
      href: "/customers",
      label: "Customers",
      icon: "👥",
      value: customerCount.toLocaleString("en-IN"),
      desc: "Shopper profiles with attributes for segmentation.",
      accentClass: ""
    },
    {
      href: "/orders",
      label: "Orders",
      icon: "📦",
      value: orderCount.toLocaleString("en-IN"),
      desc: "Purchase events powering behaviour-based audiences.",
      accentClass: ""
    },
    {
      href: "/segments",
      label: "Segments",
      icon: "🎯",
      value: String(segmentCount),
      desc: "Rule-based and AI-generated customer audiences.",
      accentClass: ""
    },
    {
      href: "/insights",
      label: "Campaigns",
      icon: "📣",
      value: String(campaignCount),
      desc: `₹${attributedRevenue.toLocaleString("en-IN")} in attributed revenue.`,
      accentClass: ""
    },
  ];

  return (
    <div className="stack">
      {/* ── Hero header ── */}
      <header style={{
        background: "linear-gradient(135deg, rgba(249,115,22,0.08), rgba(59,79,200,0.06))",
        border: "1.5px solid rgba(249,115,22,0.2)",
        borderRadius: "var(--radius-xl)",
        padding: "2rem 2.5rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        position: "relative",
        overflow: "hidden",
        boxShadow: "var(--shadow-md)"
      }}>
        {/* decorative blob */}
        <div style={{
          position: "absolute", top: "-50px", right: "-50px",
          width: "220px", height: "220px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(249,115,22,0.15), transparent 70%)",
          pointerEvents: "none"
        }} />
        <div>
          <div style={{
            fontSize: "11px", fontWeight: 900, letterSpacing: "0.16em",
            textTransform: "uppercase", color: "var(--accent)", marginBottom: "6px"
          }}>
            AI-NATIVE MINI CRM
          </div>
          <h1 style={{
            margin: "0 0 8px", fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
            fontWeight: 900, letterSpacing: "-1px", color: "var(--text)"
          }}>
            Welcome to SmartCRM
          </h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "15px", maxWidth: "480px" }}>
            Segment your D2C fashion audience, craft AI-personalised campaigns, and track attribution — all in one place.
          </p>
        </div>
        <Link className="button primary" href="/campaigns/new" style={{ fontSize: "15px", padding: "12px 22px" }}>
          + New Campaign
        </Link>
      </header>

      {apiError ? (
        <div className="card error" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "18px" }}>⚠️</span>
          <span><strong>API connection issue:</strong> {apiError}</span>
        </div>
      ) : null}

      {/* ── KPI grid ── */}
      <section className="grid">
        {stats.map((s) => (
          <Link key={s.href} href={s.href} className="card" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <span style={{ color: "var(--muted)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {s.label}
              </span>
              <span style={{ fontSize: "22px" }}>{s.icon}</span>
            </div>
            <div className="metric">{s.value}</div>
            <p className="muted" style={{ margin: 0, fontSize: "13px" }}>{s.desc}</p>
          </Link>
        ))}
      </section>

      {/* ── Quick actions row ── */}
      <section style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Link className="button" href="/segments/new" style={{ flex: 1, minWidth: "180px", justifyContent: "center" }}>
          🎯 Build a Segment
        </Link>
        <Link className="button" href="/campaigns/new" style={{ flex: 1, minWidth: "180px", justifyContent: "center" }}>
          📣 New Campaign
        </Link>
        <Link className="button" href="/import" style={{ flex: 1, minWidth: "180px", justifyContent: "center" }}>
          ⬆ Import CSV Data
        </Link>
        <Link className="button" href="/insights" style={{ flex: 1, minWidth: "180px", justifyContent: "center" }}>
          📊 View Insights
        </Link>
      </section>
    </div>
  );
}
