import type { Customer, Order, Prisma } from "@prisma/client";
import type { CustomerSummary, OrderSummary } from "@smartcrm/shared";

type CustomerWithCount = Customer & {
  _count?: {
    orders: number;
  };
};

export type OrderWithCustomer = Order & {
  customer: Pick<Customer, "id" | "name" | "email">;
};

export function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function moneyToNumber(amount: Prisma.Decimal | number) {
  return Number(amount);
}

export function serializeCustomer(customer: CustomerWithCount, totalSpent = 0): CustomerSummary {
  return {
    id: customer.id,
    externalId: customer.externalId,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    city: customer.city,
    signupDate: dateOnly(customer.signupDate),
    categoryAffinity: customer.categoryAffinity,
    aovTier: customer.aovTier,
    orderCount: customer._count?.orders ?? 0,
    totalSpent
  };
}

export function serializeOrder(order: OrderWithCustomer): OrderSummary {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    customerName: order.customer.name,
    customerEmail: order.customer.email,
    orderDate: dateOnly(order.orderDate),
    amount: moneyToNumber(order.amount),
    currency: order.currency,
    category: order.category,
    productName: order.productName,
    status: order.status
  };
}
