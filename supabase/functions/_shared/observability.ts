export type RequestContext = {
  requestId: string;
  release: string;
  origin: string | null;
  originAllowed: boolean;
  headers: Record<string, string>;
};

const CORS_ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type, x-correlation-id";
const CORS_ALLOW_METHODS = "POST, OPTIONS";
const CORS_MAX_AGE = "86400";
const LOCAL_DEV_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:5173",
  "capacitor://localhost",
  "ionic://localhost",
] as const;
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function sanitizeRequestId(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 120);
}

function sanitizeOrigin(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Basic header-splitting protection.
  if (trimmed.includes("\r") || trimmed.includes("\n")) {
    return null;
  }

  return trimmed.slice(0, 300);
}

function parseBooleanEnv(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

function parseAllowedOrigins(): Set<string> {
  const fromEnv = (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => sanitizeOrigin(value) ?? "")
    .filter(Boolean);

  const includeLocalDevOrigins = parseBooleanEnv(
    Deno.env.get("CORS_ALLOW_LOCALHOST"),
    (Deno.env.get("DENO_DEPLOYMENT_ID") ?? "").length === 0,
  );

  if (!includeLocalDevOrigins) {
    return new Set(fromEnv);
  }

  return new Set([...fromEnv, ...LOCAL_DEV_ORIGINS]);
}

function resolveReleaseTag(): string {
  const raw =
    Deno.env.get("APP_RELEASE") ??
    Deno.env.get("GIT_COMMIT_SHA") ??
    Deno.env.get("VERCEL_GIT_COMMIT_SHA") ??
    "dev";

  return raw.slice(0, 64);
}

function buildCorsHeaders(origin: string | null, originAllowed: boolean, requestId: string, release: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    "Access-Control-Allow-Methods": CORS_ALLOW_METHODS,
    "Access-Control-Max-Age": CORS_MAX_AGE,
    Vary: "Origin",
    "x-correlation-id": requestId,
    "x-app-release": release,
  };

  if (origin && originAllowed) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function createRequestContext(req: Request): RequestContext {
  const incomingRequestId = sanitizeRequestId(req.headers.get("x-correlation-id"));
  const requestId = incomingRequestId || crypto.randomUUID();
  const release = resolveReleaseTag();
  const origin = sanitizeOrigin(req.headers.get("origin"));
  const allowedOrigins = parseAllowedOrigins();
  const originAllowed = !origin || allowedOrigins.has(origin);

  return {
    requestId,
    release,
    origin,
    originAllowed,
    headers: buildCorsHeaders(origin, originAllowed, requestId, release),
  };
}

export function preflightResponse(context: RequestContext): Response {
  if (!context.originAllowed) {
    return new Response(null, { status: 403, headers: context.headers });
  }

  return new Response(null, { status: 200, headers: context.headers });
}

export function jsonResponse(
  body: Record<string, unknown>,
  context: RequestContext,
  status = 200,
): Response {
  const payload = {
    request_id: context.requestId,
    release: context.release,
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

export function ensureOriginAllowed(context: RequestContext): Response | null {
  if (context.originAllowed) {
    return null;
  }

  return jsonResponse(
    {
      success: false,
      error: "Origin is not allowed.",
    },
    context,
    403,
  );
}
