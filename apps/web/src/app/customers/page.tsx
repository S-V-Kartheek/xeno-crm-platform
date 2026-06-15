import Link from "next/link";
import { getCustomers } from "@/lib/api";

export const dynamic = "force-dynamic";

type CustomersPageProps = {
  searchParams: Promise<{
    page?: string;
    search?: string;
  }>;
};

function pageHref(page: number, search?: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("search", search);
  return `/customers?${params.toString()}`;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams;
  const page = Math.max(Number(params.page ?? "1"), 1);
  const search = params.search?.trim();
  const customers = await getCustomers(page, search);

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Customers</h1>
          <p className="muted">Paginated shopper profiles with spend and order rollups.</p>
        </div>
      </header>

      <form className="toolbar">
        <input className="input" name="search" placeholder="Search by name, email, city, affinity" defaultValue={search} />
        <button className="button primary" type="submit">
          Search
        </button>
      </form>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>City</th>
              <th>Affinity</th>
              <th>AOV</th>
              <th>Orders</th>
              <th>Total spent</th>
            </tr>
          </thead>
          <tbody>
            {customers.data.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <Link href={`/customers/${customer.id}`}>{customer.name}</Link>
                </td>
                <td>{customer.email}</td>
                <td>{customer.city ?? "—"}</td>
                <td>{customer.categoryAffinity ?? "—"}</td>
                <td>
                  <span className="badge">{customer.aovTier}</span>
                </td>
                <td>{customer.orderCount}</td>
                <td>₹{customer.totalSpent.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pager">
        {page > 1 ? (
          <Link className="button" href={pageHref(page - 1, search)}>
            Previous
          </Link>
        ) : null}
        <span className="button">
          Page {customers.meta.page} of {customers.meta.totalPages}
        </span>
        {page < customers.meta.totalPages ? (
          <Link className="button" href={pageHref(page + 1, search)}>
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}
