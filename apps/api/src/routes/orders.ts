import { Router } from "express";
import { orderCreateSchema, paginationQuerySchema } from "@smartcrm/shared";
import { asyncRoute, parseBody, parseQuery } from "../http.js";
import { getPrisma } from "../prisma.js";
import { serializeOrder, type OrderWithCustomer } from "../serializers.js";

export const ordersRouter = Router();

ordersRouter.get(
  "/",
  asyncRoute(async (request, response) => {
    const { page, pageSize, search } = parseQuery(paginationQuerySchema, request);
    const prisma = getPrisma();
    const where = search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: "insensitive" as const } },
            { category: { contains: search, mode: "insensitive" as const } },
            { productName: { contains: search, mode: "insensitive" as const } },
            { customer: { name: { contains: search, mode: "insensitive" as const } } },
            { customer: { email: { contains: search, mode: "insensitive" as const } } }
          ]
        }
      : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { orderDate: "desc" },
        include: { customer: { select: { id: true, name: true, email: true } } }
      }),
      prisma.order.count({ where })
    ]);

    response.json({
      data: orders.map(serializeOrder),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    });
  })
);

ordersRouter.get(
  "/:id",
  asyncRoute(async (request, response) => {
    const order = (await getPrisma().order.findUnique({
      where: { id: String(request.params.id ?? "") },
      include: { customer: { select: { id: true, name: true, email: true } } }
    })) as OrderWithCustomer | null;

    if (!order) {
      response.status(404).json({ error: "Order not found" });
      return;
    }

    response.json({ data: serializeOrder(order) });
  })
);

ordersRouter.post(
  "/",
  asyncRoute(async (request, response) => {
    const input = parseBody(orderCreateSchema, request);
    const prisma = getPrisma();
    const customer = input.customerId
      ? await prisma.customer.findUnique({ where: { id: input.customerId } })
      : await prisma.customer.findUnique({ where: { email: input.customerEmail } });

    if (!customer) {
      response.status(400).json({ error: "Customer not found for order" });
      return;
    }

    const order = await prisma.order.create({
      data: {
        orderNumber: input.orderNumber,
        customerId: customer.id,
        orderDate: new Date(input.orderDate),
        amount: input.amount,
        currency: input.currency,
        category: input.category,
        productName: input.productName,
        status: input.status
      },
      include: { customer: { select: { id: true, name: true, email: true } } }
    });

    response.status(201).json({ data: serializeOrder(order) });
  })
);
