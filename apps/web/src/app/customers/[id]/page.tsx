import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer } from "@/lib/api";

export const dynamic = "force-dynamic";

type CustomerDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;
  let customer;

  try {
    customer = await getCustomer(id);
  } catch {
    notFound();
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Link className="muted" href="/customers">
            ← Customers
          </Link>
          <h1>{customer.name}</h1>
          <p className="muted">{customer.email}</p>
        </div>
        <span className="badge">{customer.aovTier} AOV</span>
      </header>

      <section className="grid">
        <div className="card">
          <span className="muted">City</span>
          <div className="metric">{customer.city ?? "—"}</div>
        </div>
        <div className="card">
          <span className="muted">Category affinity</span>
          <div className="metric">{customer.categoryAffinity ?? "—"}</div>
        </div>
        <div className="card">
          <span className="muted">Total spent</span>
          <div className="metric">₹{customer.totalSpent.toLocaleString("en-IN")}</div>
        </div>
      </section>

      <section className="card table-wrap">
        <h2>Order history</h2>
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Date</th>
              <th>Product</th>
              <th>Category</th>
              <th>Status</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {customer.orders.map((order) => (
              <tr key={order.id}>
                <td>{order.orderNumber}</td>
                <td>{order.orderDate}</td>
                <td>{order.productName}</td>
                <td>{order.category}</td>
                <td>
                  <span className={`badge ${order.status === "completed" ? "good" : "bad"}`}>{order.status}</span>
                </td>
                <td>₹{order.amount.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
