import Link from "next/link";
import { getSegments } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Segments | SmartCRM",
  description: "Rule-based and AI-generated customer audiences"
};

export default async function SegmentsPage() {
  let segments: Awaited<ReturnType<typeof getSegments>> | null = null;
  let error: string | null = null;

  try {
    segments = await getSegments();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load segments";
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1>Segments</h1>
          <p className="muted">
            Rule-based and AI-assisted customer audiences. Each segment shows a live customer count.
          </p>
        </div>
        <Link className="button primary" href="/segments/new">
          + New segment
        </Link>
      </header>

      {error ? <div className="card error">{error}</div> : null}

      {segments && segments.data.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">🎯</div>
          <h2>No segments yet</h2>
          <p className="muted">
            Create your first audience segment — build manually with filter rules, or describe your
            audience in plain English and let AI generate the rules for you.
          </p>
          <Link className="button primary" href="/segments/new">
            Build your first segment
          </Link>
        </div>
      ) : null}

      {segments && segments.data.length > 0 ? (
        <div className="segment-grid">
          {segments.data.map((seg) => (
            <Link key={seg.id} href={`/segments/${seg.id}`} className="segment-card">
              <div className="segment-card-top">
                <div className="segment-name">{seg.name}</div>
                {seg.createdVia === "ai_generated" ? (
                  <span className="badge ai-badge">✦ AI</span>
                ) : (
                  <span className="badge">Manual</span>
                )}
              </div>
              {seg.description ? <p className="muted segment-desc">{seg.description}</p> : null}
              <div className="segment-meta">
                <div className="segment-count">
                  <span className="count-num">{seg.customerCount.toLocaleString("en-IN")}</span>
                  <span className="muted"> customers</span>
                </div>
                <div className="segment-rules-summary">
                  {seg.rules.conditions.length} condition
                  {seg.rules.conditions.length !== 1 ? "s" : ""} &middot; {seg.rules.logic}
                </div>
              </div>
              <div className="segment-conditions-preview">
                {seg.rules.conditions.slice(0, 3).map((c, i) => (
                  <span key={i} className="condition-chip">
                    {c.field} {c.operator}{" "}
                    {Array.isArray(c.value) ? c.value.join(", ") : String(c.value)}
                  </span>
                ))}
                {seg.rules.conditions.length > 3 ? (
                  <span className="condition-chip muted">
                    +{seg.rules.conditions.length - 3} more
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
