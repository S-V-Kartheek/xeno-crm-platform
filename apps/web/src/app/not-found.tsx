import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="card">
      <h1>Not found</h1>
      <p className="muted">The requested CRM record could not be found.</p>
      <Link className="button primary" href="/customers">
        Back to customers
      </Link>
    </div>
  );
}
