export const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
} as const;

export type RequestContext = {
  requestId: string;
  headers: Record<string, string>;
};

function sanitizeRequestId(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 120);
}

export function createRequestContext(req: Request): RequestContext {
  const incomingRequestId = sanitizeRequestId(req.headers.get("x-correlation-id"));
  const requestId = incomingRequestId || crypto.randomUUID();

  return {
    requestId,
    headers: {
      ...BASE_CORS_HEADERS,
      "x-correlation-id": requestId,
    },
  };
}

export function preflightResponse(context: RequestContext): Response {
  return new Response(null, { status: 200, headers: context.headers });
}

export function jsonResponse(
  body: Record<string, unknown>,
  context: RequestContext,
  status = 200,
): Response {
  const payload = {
    request_id: context.requestId,
    ...body,
  };

  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...context.headers, "Content-Type": "application/json" },
  });
}

export function logWithContext(
  level: "log" | "warn" | "error",
  context: RequestContext,
  message: string,
  details?: unknown,
) {
  const logger = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  const prefix = `[${context.requestId}] ${message}`;

  if (details === undefined) {
    logger(prefix);
    return;
  }

  logger(prefix, details);
}

