import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const firstNames = ["Aarav", "Vivaan", "Anaya", "Diya", "Ishaan", "Meera", "Kabir", "Nisha", "Riya", "Arjun", "Tara", "Dev"];
const lastNames = ["Sharma", "Iyer", "Kapoor", "Rao", "Mehta", "Nair", "Bose", "Khanna", "Menon", "Saxena"];
const cities = ["Mumbai", "Delhi", "Bengaluru", "Pune", "Hyderabad", "Chennai", "Jaipur", "Ahmedabad"];
const categories = ["Summer Dresses", "Denim", "Athleisure", "Festive Wear", "Footwear", "Accessories"];
const productsByCategory: Record<string, string[]> = {
  "Summer Dresses": ["Linen Midi Dress", "Floral Wrap Dress", "Cotton Sundress"],
  Denim: ["High-Rise Jeans", "Denim Jacket", "Straight Fit Jeans"],
  Athleisure: ["Ribbed Joggers", "Oversized Hoodie", "Performance Tee"],
  "Festive Wear": ["Embroidered Kurta", "Silk Dupatta", "Mirrorwork Co-ord"],
  Footwear: ["Block Heel Sandals", "White Sneakers", "Kolhapuri Flats"],
  Accessories: ["Canvas Tote", "Minimal Belt", "Gold Hoop Earrings"]
};

const csvEscape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)]!;
const dateDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const customers = Array.from({ length: 150 }, (_, index) => {
  const firstName = pick(firstNames);
  const lastName = pick(lastNames);
  const categoryAffinity = pick(categories);
  const signupDaysAgo = 20 + Math.floor(Math.random() * 520);
  const aovTier = index % 7 === 0 ? "high" : index % 3 === 0 ? "mid" : "value";

  return {
    externalId: `cust_${String(index + 1).padStart(4, "0")}`,
    name: `${firstName} ${lastName}`,
    email: `${firstName}.${lastName}.${index + 1}@gmail.com`.toLowerCase(),
    phone: `+91${Math.floor(7000000000 + Math.random() * 1999999999)}`,
    city: pick(cities),
    signupDate: dateDaysAgo(signupDaysAgo),
    categoryAffinity,
    aovTier
  };
});

const orders = customers.flatMap((customer, customerIndex) => {
  const orderCount = customer.aovTier === "high" ? 5 + Math.floor(Math.random() * 4) : 1 + Math.floor(Math.random() * 4);
  return Array.from({ length: orderCount }, (_, orderIndex) => {
    const category = Math.random() < 0.62 ? customer.categoryAffinity : pick(categories);
    const baseAmount = customer.aovTier === "high" ? 4200 : customer.aovTier === "mid" ? 2300 : 1200;
    const amount = Math.round(baseAmount * (0.7 + Math.random() * 0.9));
    const recencyCluster = customerIndex % 4 === 0 ? 14 : customerIndex % 4 === 1 ? 45 : customerIndex % 4 === 2 ? 95 : 190;

    return {
      orderNumber: `ORD-${String(customerIndex + 1).padStart(4, "0")}-${orderIndex + 1}`,
      customerEmail: customer.email,
      orderDate: dateDaysAgo(recencyCluster + orderIndex * 21 + Math.floor(Math.random() * 12)),
      amount,
      currency: "INR",
      category,
      productName: pick(productsByCategory[category]),
      status: Math.random() > 0.04 ? "completed" : "returned"
    };
  });
});

const customerRows = [
  ["externalId", "name", "email", "phone", "city", "signupDate", "categoryAffinity", "aovTier"],
  ...customers.map((customer) => [
    customer.externalId,
    customer.name,
    customer.email,
    customer.phone,
    customer.city,
    customer.signupDate,
    customer.categoryAffinity,
    customer.aovTier
  ])
];

const orderRows = [
  ["orderNumber", "customerEmail", "orderDate", "amount", "currency", "category", "productName", "status"],
  ...orders.map((order) => [
    order.orderNumber,
    order.customerEmail,
    order.orderDate,
    order.amount,
    order.currency,
    order.category,
    order.productName,
    order.status
  ])
];

const toCsv = (rows: (string | number)[][]) => rows.map((row) => row.map(csvEscape).join(",")).join("\n");

async function main() {
  await mkdir("data", { recursive: true });
  await writeFile(join("data", "customers.csv"), toCsv(customerRows));
  await writeFile(join("data", "orders.csv"), toCsv(orderRows));
  console.log(`Generated ${customers.length} customers and ${orders.length} orders.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
