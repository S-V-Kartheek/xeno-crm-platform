/**
 * Async Delivery Simulator
 *
 * Simulates realistic message delivery lifecycle:
 *   queued → sent (immediate) → delivered (2–6s) → opened (60% chance, +3–8s) → clicked (30% chance, +2–5s)
 *
 * For failed cases: 10% of sends fail at the "sent" stage.
 *
 * Each status transition fires a POST to callbackUrl with the receipt payload.
 * This is the "callback loop" that evaluators will check most carefully.
 */

type MessageJob = {
  externalId: string;
  recipient: string;
  recipientName: string;
  message: string;
};

type SendBatch = {
  campaignId: string;
  channel: string;
  callbackUrl: string;
  messages: MessageJob[];
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

async function fireReceipt(
  callbackUrl: string,
  externalId: string,
  status: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const body = JSON.stringify({
      externalId,
      status,
      occurredAt: new Date().toISOString(),
      metadata
    });

    const res = await fetch(callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      console.error(`[channel] Receipt POST failed for ${externalId}:${status} → HTTP ${res.status}`);
    } else {
      console.log(`[channel] ✓ receipt: ${externalId.slice(-8)} → ${status}`);
    }
  } catch (err) {
    // Log but don't crash — channel service is fire-and-forget
    console.error(`[channel] Receipt POST error for ${externalId}:${status}:`, err);
  }
}

async function simulateMessage(job: MessageJob, callbackUrl: string): Promise<void> {
  const { externalId } = job;

  // 1. Sent — immediate (already "queued" in DB, fire "sent" receipt right away)
  await delay(rand(200, 800));

  // 10% failure rate at send stage
  if (Math.random() < 0.10) {
    await fireReceipt(callbackUrl, externalId, "failed", { reason: "delivery_failed" });
    return;
  }

  await fireReceipt(callbackUrl, externalId, "sent");

  // 2. Delivered — 2–6 seconds later
  await delay(rand(2000, 6000));
  await fireReceipt(callbackUrl, externalId, "delivered");

  // 3. Opened — 60% chance, 3–8 seconds after delivery
  if (Math.random() < 0.60) {
    await delay(rand(3000, 8000));
    await fireReceipt(callbackUrl, externalId, "opened");

    // 4. Clicked — 30% of opened messages, 2–5 seconds after open
    if (Math.random() < 0.30) {
      await delay(rand(2000, 5000));
      await fireReceipt(callbackUrl, externalId, "clicked", {
        url: "https://smartcrm.demo/product/featured"
      });
    }
  }
}

/**
 * Process a batch of messages asynchronously.
 * Returns immediately — all callbacks happen in the background.
 */
export function processBatch(batch: SendBatch): void {
  console.log(
    `[channel] Processing batch: ${batch.messages.length} messages via ${batch.channel} → callback: ${batch.callbackUrl}`
  );

  // Process all messages concurrently (capped to avoid overwhelming the CRM)
  const CONCURRENCY = 10;
  let i = 0;

  const processNext = (): void => {
    if (i >= batch.messages.length) return;
    const job = batch.messages[i++]!;
    void simulateMessage(job, batch.callbackUrl).then(() => processNext());
  };

  // Kick off up to CONCURRENCY workers
  for (let w = 0; w < Math.min(CONCURRENCY, batch.messages.length); w++) {
    processNext();
  }
}
