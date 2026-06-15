"use client";

import { useState } from "react";
import type { ImportReport } from "@smartcrm/shared";
import { getApiUrl } from "@/lib/api";

const customerExample = `externalId,name,email,phone,city,signupDate,categoryAffinity,aovTier
cust_demo_001,Aisha Mehta,aisha.demo@gmail.com,+919876543210,Mumbai,2026-01-12,Summer Dresses,high`;

const orderExample = `orderNumber,customerEmail,orderDate,amount,currency,category,productName,status
ORD-DEMO-001,aisha.demo@gmail.com,2026-06-01,3499,INR,Summer Dresses,Linen Midi Dress,completed`;

type ImportKind = "customers" | "orders";

async function importCsv(kind: ImportKind, csv: string) {
  const response = await fetch(`${getApiUrl()}/import/${kind}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/csv"
    },
    body: csv
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as { data: ImportReport };
}

export default function ImportPage() {
  const [kind, setKind] = useState<ImportKind>("customers");
  const [csv, setCsv] = useState(customerExample);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  function switchKind(nextKind: ImportKind) {
    setKind(nextKind);
    setCsv(nextKind === "customers" ? customerExample : orderExample);
    setReport(null);
    setError(null);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsImporting(true);
    setError(null);
    setReport(null);

    try {
      const result = await importCsv(kind, csv);
      setReport(result.data);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1>CSV Import</h1>
          <p className="muted">Paste customer or order CSV data and get a row-level validation report.</p>
        </div>
      </header>

      <section className="card stack">
        <div className="toolbar">
          <button className={`button ${kind === "customers" ? "primary" : ""}`} type="button" onClick={() => switchKind("customers")}>
            Customers
          </button>
          <button className={`button ${kind === "orders" ? "primary" : ""}`} type="button" onClick={() => switchKind("orders")}>
            Orders
          </button>
        </div>

        <form className="stack" onSubmit={onSubmit}>
          <textarea className="textarea" value={csv} onChange={(event) => setCsv(event.target.value)} />
          <button className="button primary" type="submit" disabled={isImporting}>
            {isImporting ? "Importing..." : `Import ${kind}`}
          </button>
        </form>
      </section>

      {error ? <section className="card error">{error}</section> : null}

      {report ? (
        <section className="card stack">
          <h2>Import report</h2>
          <div className="grid">
            <div>
              <span className="muted">Received</span>
              <div className="metric">{report.received}</div>
            </div>
            <div>
              <span className="muted">Inserted</span>
              <div className="metric">{report.inserted}</div>
            </div>
            <div>
              <span className="muted">Failed</span>
              <div className="metric">{report.failed}</div>
            </div>
          </div>
          {report.errors.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {report.errors.map((rowError) => (
                    <tr key={`${rowError.row}-${rowError.message}`}>
                      <td>{rowError.row}</td>
                      <td>{rowError.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">No row errors. Tiny confetti, respectfully.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
