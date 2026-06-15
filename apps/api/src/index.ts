import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { errorHandler } from "./http.js";
import { customersRouter } from "./routes/customers.js";
import { importsRouter } from "./routes/imports.js";
import { ordersRouter } from "./routes/orders.js";
import { segmentsRouter } from "./routes/segments.js";
import { campaignsRouter } from "./routes/campaigns.js";
import { receiptsRouter } from "./routes/receipts.js";
import { insightsRouter } from "./routes/insights.js";

const app = express();

// Allow any localhost port in dev — Next.js may pick 3000, 3001, etc.
const allowedOrigins = [env.CORS_ORIGIN, "http://localhost:3000", "http://localhost:3001", "http://localhost:3002"];
app.use(cors({ origin: allowedOrigins }));
app.use(express.text({ type: ["text/csv", "application/csv", "text/plain"], limit: "5mb" }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "smartcrm-api" });
});

app.use("/customers", customersRouter);
app.use("/orders", ordersRouter);
app.use("/import", importsRouter);
app.use("/segments", segmentsRouter);
app.use("/campaigns", campaignsRouter);
app.use("/receipts", receiptsRouter);
app.use("/insights", insightsRouter);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`SmartCRM API listening on http://localhost:${env.PORT}`);
});
