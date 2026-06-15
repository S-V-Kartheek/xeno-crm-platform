import { Router } from "express";
import { parse as parseCsv } from "csv-parse/sync";
import {
  customerCreateSchema,
  importCsvBodySchema,
  orderCreateSchema,
  type ImportReport,
  type ImportRowError
} from "@smartcrm/shared";
import { asyncRoute } from "../http.js";
import { getPrisma } from "../prisma.js";

export const importsRouter = Router();

type CsvRow = Record<string, string>;

function getCsvPayload(body: unknown) {
  if (typeof body === "string") {
    return body;
  }

  return importCsvBodySchema.parse(body).csv;
}

function parseRows(csv: string): CsvRow[] {
  return parseCsv(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
  }) as CsvRow[];
}

function emptyReport(received: number): ImportReport {
  return {
    received,
    inserted: 0,
    updated: 0,
    failed: 0,
    errors: []
  };
}

function addRowError(errors: ImportRowError[], row: number, raw: CsvRow, message: string) {
  errors.push({ row, raw, message });
}

importsRouter.post(
  "/customers",
  asyncRoute(async (request, response) => {
    const rows = parseRows(getCsvPayload(request.body));
    const report = emptyReport(rows.length);
    const prisma = getPrisma();

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const parsed = customerCreateSchema.safeParse(row);

      if (!parsed.success) {
        report.failed += 1;
        addRowError(report.errors, rowNumber, row, parsed.error.issues.map((issue) => issue.message).join("; "));
        continue;
      }

      try {
        const existing = await prisma.customer.findUnique({ where: { email: parsed.data.email } });
        await prisma.customer.upsert({
          where: { email: parsed.data.email },
          create: {
            ...parsed.data,
            signupDate: new Date(parsed.data.signupDate)
          },
          update: {
            ...parsed.data,
            signupDate: new Date(parsed.data.signupDate)
          }
        });

        if (existing) {
          report.updated += 1;
        } else {
          report.inserted += 1;
        }
      } catch (error) {
        report.failed += 1;
        addRowError(report.errors, rowNumber, row, error instanceof Error ? error.message : "Could not import customer");
      }
    }

    response.json({ data: report });
  })
);

importsRouter.post(
  "/orders",
  asyncRoute(async (request, response) => {
    const rows = parseRows(getCsvPayload(request.body));
    const report = emptyReport(rows.length);
    const prisma = getPrisma();

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const parsed = orderCreateSchema.safeParse(row);

      if (!parsed.success) {
        report.failed += 1;
        addRowError(report.errors, rowNumber, row, parsed.error.issues.map((issue) => issue.message).join("; "));
        continue;
      }

      try {
        const customer = parsed.data.customerId
          ? await prisma.customer.findUnique({ where: { id: parsed.data.customerId } })
          : await prisma.customer.findUnique({ where: { email: parsed.data.customerEmail } });

        if (!customer) {
          report.failed += 1;
          addRowError(report.errors, rowNumber, row, "Customer not found for order");
          continue;
        }

        const existing = await prisma.order.findUnique({ where: { orderNumber: parsed.data.orderNumber } });
        await prisma.order.upsert({
          where: { orderNumber: parsed.data.orderNumber },
          create: {
            orderNumber: parsed.data.orderNumber,
            customerId: customer.id,
            orderDate: new Date(parsed.data.orderDate),
            amount: parsed.data.amount,
            currency: parsed.data.currency,
            category: parsed.data.category,
            productName: parsed.data.productName,
            status: parsed.data.status
          },
          update: {
            customerId: customer.id,
            orderDate: new Date(parsed.data.orderDate),
            amount: parsed.data.amount,
            currency: parsed.data.currency,
            category: parsed.data.category,
            productName: parsed.data.productName,
            status: parsed.data.status
          }
        });

        if (existing) {
          report.updated += 1;
        } else {
          report.inserted += 1;
        }
      } catch (error) {
        report.failed += 1;
        addRowError(report.errors, rowNumber, row, error instanceof Error ? error.message : "Could not import order");
      }
    }

    response.json({ data: report });
  })
);
