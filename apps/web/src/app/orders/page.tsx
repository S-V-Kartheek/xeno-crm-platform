import { getOrders } from "@/lib/api";

export const dynamic = "force-dynamic";

type OrdersPageProps = {
  searchParams: Promise<{
    page?: string;
    search?: string;
  }>;
};

function pageHref(page: number, search?: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("search", search);
  return `/orders?${params.toString()}`;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const page = Math.max(Number(params.page ?? "1"), 1);
  const search = params.search?.trim();
  const orders = await getOrders(page, search);

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Orders</h1>
          <p className="muted">Purchase history for future behaviour-based segmentation.</p>
        </div>
      </header>

      <form className="toolbar">
        <input className="input" name="search" placeholder="Search by order, product, category, customer" defaultValue={search} />
        <button className="button primary" type="submit">
          Search
        </button>
      </form>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Product</th>
              <th>Category</th>
              <th>Status</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {orders.data.map((order) => (
              <tr key={order.id}>
                <td>{order.orderNumber}</td>
                <td>{order.customerName}</td>
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
      </div>

      <div className="pager">
        {page > 1 ? (
          <a className="button" href={pageHref(page - 1, search)}>
            Previous
          </a>
        ) : null}
        <span className="button">
          Page {orders.meta.page} of {orders.meta.totalPages}
        </span>
        {page < orders.meta.totalPages ? (
          <a className="button" href={pageHref(page + 1, search)}>
            Next
          </a>
        ) : null}
      </div>
    </div>
  );
}
