/**
 * Receipts router — idempotent webhook handler for channel service callbacks.
 *
 * The channel service POSTs here for each delivery event:
 *   { externalId, status, occurredAt?, metadata? }
 *
 * Idempotency: same (communicationId, status) @@unique constraint on
 * CommunicationEvent means a duplicate is a DB-level no-op (we catch the
 * unique violation and return 200 OK rather than 409).
 */

import { Router } from "express";
import { receiptSchema } from "@smartcrm/shared";
import { asyncRoute, parseBody } from "../http.js";
import { getPrisma } from "../prisma.js";
import type { Prisma } from "@prisma/client";

export const receiptsRouter = Router();

receiptsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const receipt = parseBody(receiptSchema, req);
    const prisma = getPrisma();

    // Look up the communication by its externalId
    const comm = await prisma.communication.findUnique({
      where: { externalId: receipt.externalId }
    });

    if (!comm) {
      // Unknown externalId — could be a stale retry from the channel service.
      // Return 200 (not 404) so the channel service doesn't keep retrying.
      res.json({ ok: true, note: "Unknown externalId — receipt ignored" });
      return;
    }

    const occurredAt = receipt.occurredAt ? new Date(receipt.occurredAt) : new Date();

    try {
      // Insert event — the @@unique([communicationId, status]) constraint
      // means a duplicate is rejected at the DB level.
      await prisma.communicationEvent.create({
        data: {
          communicationId: comm.id,
          status: receipt.status,
          occurredAt,
          metadata: receipt.metadata as Prisma.InputJsonValue | undefined
        }
      });

      // Denormalise current status onto Communication for easy querying
      await prisma.communication.update({
        where: { id: comm.id },
        data: { status: receipt.status }
      });

      res.json({ ok: true, recorded: receipt.status });
    } catch (err: unknown) {
      // Unique constraint violation = duplicate receipt — idempotent, return OK
      const isDuplicate =
        err instanceof Error &&
        (err.message.includes("Unique constraint") || err.message.includes("P2002"));

      if (isDuplicate) {
        res.json({ ok: true, note: "Duplicate receipt — already recorded" });
        return;
      }

      throw err; // re-throw unexpected errors → caught by asyncRoute → 500
    }
  })
);
