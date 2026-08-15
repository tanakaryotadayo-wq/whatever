const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_403_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded", "backendError"]);

export function driveErrorStatus(error) {
  const value = error?.response?.status ?? error?.status ?? error?.code;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function driveErrorReason(error) {
  const errors = error?.response?.data?.error?.errors;
  return Array.isArray(errors) && errors[0]?.reason ? String(errors[0].reason) : null;
}

export function isRetryableDriveError(error) {
  const status = driveErrorStatus(error);
  if (RETRYABLE_STATUS.has(status)) return true;
  return status === 403 && RETRYABLE_403_REASONS.has(driveErrorReason(error));
}

function retryAfterMs(error) {
  const raw = error?.response?.headers?.["retry-after"] ?? error?.response?.headers?.get?.("retry-after");
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}

export async function withDriveRetry(operation, {
  maxAttempts = 5,
  baseDelayMs = 250,
  maxDelayMs = 8000,
  random = Math.random,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !isRetryableDriveError(error)) throw error;
      const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const delay = retryAfterMs(error) ?? Math.floor(exponential * (0.5 + random()));
      await sleep(delay);
    }
  }
  throw lastError;
}
