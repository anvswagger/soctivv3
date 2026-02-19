import type { ZodError } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export function formatZodError(error: ZodError): string {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return "Invalid request payload.";
  }

  const fieldPath = firstIssue.path.length > 0 ? firstIssue.path.join(".") : "payload";
  return `Invalid field "${fieldPath}": ${firstIssue.message}`;
}
