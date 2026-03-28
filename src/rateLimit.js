const buckets = new Map();

function clientKey(req) {
  const xf = req.headers["x-forwarded-for"];
  const fromProxy = typeof xf === "string" ? xf.split(",")[0].trim() : "";
  return fromProxy || req.ip || req.socket?.remoteAddress || "unknown";
}

/**
 * Simple in-memory rate limit.
 * @param {string} scope
 * @param {number} maxRequests
 * @param {number} windowMs
 */
export function createRateLimitMiddleware(scope, maxRequests, windowMs) {
  return (req, res, next) => {
    const key = `${scope}:${clientKey(req)}`;
    const now = Date.now();
    const arr = buckets.get(key) || [];
    const fresh = arr.filter((ts) => now - ts < windowMs);
    if (fresh.length >= maxRequests) {
      return res.status(429).json({
        error: "rate_limited",
        scope
      });
    }
    fresh.push(now);
    buckets.set(key, fresh);
    return next();
  };
}

export function messageRateLimit() {
  const max = parseInt(process.env.RATE_LIMIT_MESSAGE_MAX ?? "20", 10);
  const sec = parseInt(process.env.RATE_LIMIT_MESSAGE_WINDOW_SEC ?? "300", 10);
  return createRateLimitMiddleware("message", Number.isFinite(max) ? max : 20, (Number.isFinite(sec) ? sec : 300) * 1000);
}

export function reminderRateLimit() {
  const max = parseInt(process.env.RATE_LIMIT_REMINDER_MAX ?? "10", 10);
  const sec = parseInt(process.env.RATE_LIMIT_REMINDER_WINDOW_SEC ?? "300", 10);
  return createRateLimitMiddleware("reminder", Number.isFinite(max) ? max : 10, (Number.isFinite(sec) ? sec : 300) * 1000);
}
