import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";

export function parseBody<T>(schema: ZodSchema<T>, request: Request): T {
  return schema.parse(request.body);
}

export function parseQuery<T>(schema: ZodSchema<T>, request: Request): T {
  return schema.parse(request.query);
}

/**
 * parseBodyRaw — accepts either:
 * - A ZodSchema with a key: parses request.body[key] (e.g. "rules" → body.rules)
 * - A function: called with request.body directly (e.g. for custom validators)
 * - "direct" mode with a function: same as function mode
 */
export function parseBodyRaw<T>(
  parser: ZodSchema<T> | ((body: unknown) => T),
  request: Request,
  key?: string | "direct"
): T {
  if (typeof parser === "function") {
    return (parser as (body: unknown) => T)(request.body);
  }
  const target = key && key !== "direct" ? (request.body as Record<string, unknown>)[key] : request.body;
  return (parser as ZodSchema<T>).parse(target);
}

export function asyncRoute(handler: (request: Request, response: Response, next: NextFunction) => Promise<void>) {
  return (request: Request, response: Response, next: NextFunction) => {
    handler(request, response, next).catch(next);
  };
}

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: "Validation failed",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
    return;
  }

  // Custom errors with a status property
  if (error instanceof Error && "status" in error) {
    response.status(Number((error as Error & { status: number }).status)).json({ error: error.message });
    return;
  }

  if (error instanceof Error) {
    response.status(500).json({ error: error.message });
    return;
  }

  response.status(500).json({ error: "Unexpected server error" });
}
