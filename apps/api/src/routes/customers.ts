import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { customerCreateSchema, customerUpdateSchema, paginationQuerySchema } from "@smartcrm/shared";
import { asyncRoute, parseBody, parseQuery } from "../http.js";
import { getPrisma } from "../prisma.js";
import { serializeCustomer, serializeOrder } from "../serializers.js";

export const customersRouter = Router();

type CustomerDetailRecord = Prisma.CustomerGetPayload<{
  include: {
    _count: { select: { orders: true } };
    orders: {
      include: { customer: { select: { id: true; name: true; email: true } } };
    };
  };
}>;

customersRouter.get(
  "/",
  asyncRoute(async (request, response) => {
    const { page, pageSize, search } = parseQuery(paginationQuerySchema, request);
    const prisma = getPrisma();
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { city: { contains: search, mode: "insensitive" as const } },
            { categoryAffinity: { contains: search, mode: "insensitive" as const } }
          ]
        }
      : {};

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { orders: true } } }
      }),
      prisma.customer.count({ where })
    ]);

    const rows = await Promise.all(
      customers.map(async (customer) => {
        const aggregate = await prisma.order.aggregate({
          where: { customerId: customer.id, status: "completed" },
          _sum: { amount: true }
        });
        return serializeCustomer(customer, Number(aggregate._sum.amount ?? 0));
      })
    );

    response.json({
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    });
  })
);

customersRouter.get(
  "/:id",
  asyncRoute(async (request, response) => {
    const prisma = getPrisma();
    const customerId = String(request.params.id ?? "");
    const customer = (await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        _count: { select: { orders: true } },
        orders: {
          orderBy: { orderDate: "desc" },
          include: { customer: { select: { id: true, name: true, email: true } } }
        }
      }
    })) as CustomerDetailRecord | null;

    if (!customer) {
      response.status(404).json({ error: "Customer not found" });
      return;
    }

    const aggregate = await prisma.order.aggregate({
      where: { customerId: customer.id, status: "completed" },
      _sum: { amount: true }
    });

    response.json({
      data: {
        ...serializeCustomer(customer, Number(aggregate._sum.amount ?? 0)),
        orders: customer.orders.map(serializeOrder)
      }
    });
  })
);

customersRouter.post(
  "/",
  asyncRoute(async (request, response) => {
    const input = parseBody(customerCreateSchema, request);
    const customer = await getPrisma().customer.create({
      data: {
        ...input,
        signupDate: new Date(input.signupDate)
      },
      include: { _count: { select: { orders: true } } }
    });

    response.status(201).json({ data: serializeCustomer(customer) });
  })
);

customersRouter.patch(
  "/:id",
  asyncRoute(async (request, response) => {
    const input = parseBody(customerUpdateSchema, request);
    const customer = await getPrisma().customer.update({
      where: { id: String(request.params.id ?? "") },
      data: {
        ...input,
        signupDate: input.signupDate ? new Date(input.signupDate) : undefined
      },
      include: { _count: { select: { orders: true } } }
    });

    response.json({ data: serializeCustomer(customer) });
  })
);
