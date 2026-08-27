export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  if (process.env["NODE_ENV"] !== "production") {
    console.error("[VEN+ Error]", error, context);
  }
}
