import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { integerEnv, MAX_TIMER_MS } from "./config.js";

type WebhookConfig = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
};
type DeliveryResult = { ok: boolean; attempts: number; status?: number; cancelled?: boolean };

function readConfig(): WebhookConfig {
  return {
    maxRetries: integerEnv("AGENTATION_WEBHOOK_MAX_RETRIES", 3, 0, 10),
    baseDelayMs: integerEnv("AGENTATION_WEBHOOK_BASE_DELAY_MS", 1000, 1, MAX_TIMER_MS),
    maxDelayMs: integerEnv("AGENTATION_WEBHOOK_MAX_DELAY_MS", 30_000, 1, MAX_TIMER_MS),
    timeoutMs: integerEnv("AGENTATION_WEBHOOK_TIMEOUT_MS", 10_000, 1, MAX_TIMER_MS),
  };
}

function retryAfterMs(value: string | null): number {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

export function createWebhookDispatcher(config: WebhookConfig = readConfig()) {
  const deliveries = new Set<AbortController>();
  let closed = false;

  async function send(url: string, payload: string): Promise<DeliveryResult> {
    if (closed) return { ok: false, attempts: 0, cancelled: true };
    try {
      const target = new URL(url);
      if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
        return { ok: false, attempts: 0 };
      }
    } catch {
      return { ok: false, attempts: 0 };
    }

    const delivery = new AbortController();
    const id = randomUUID();
    deliveries.add(delivery);
    let attempts = 0;
    let status: number | undefined;
    try {
      for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        if (delivery.signal.aborted) break;
        attempts++;
        status = undefined;
        let retryAfter = 0;
        const request = new AbortController();
        const abort = () => request.abort();
        delivery.signal.addEventListener('abort', abort, { once: true });
        const timeout = setTimeout(abort, config.timeoutMs);
        timeout.unref();
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Agentation-Webhook/1.0',
              'X-Agentation-Delivery-Id': id,
            },
            body: payload,
            signal: request.signal,
          });
          status = response.status;
          // We only need the status and retry hint. Release the response body.
          void response.body?.cancel().catch(() => {});
          if (response.ok) return { ok: true, attempts, status };
          if (status !== 429 && (status < 500 || status >= 600)) {
            return { ok: false, attempts, status };
          }
          retryAfter = retryAfterMs(response.headers.get('retry-after'));
        } catch {
          // A valid fetch URL can still fail or time out. Both are bounded retries.
          if (delivery.signal.aborted) break;
        } finally {
          clearTimeout(timeout);
          delivery.signal.removeEventListener('abort', abort);
        }
        if (attempt === config.maxRetries) break;
        // Don't retry earlier than requested or exceed the configured wait bound.
        if (retryAfter > config.maxDelayMs) break;
        const backoff = Math.min(config.maxDelayMs,
          Math.floor(config.baseDelayMs * 2 ** attempt * (1 + Math.random() * 0.25)));
        try {
          await delay(Math.max(backoff, retryAfter), undefined, { signal: delivery.signal, ref: false });
        } catch {
          break;
        }
      }
      return { ok: false, attempts, status, ...(delivery.signal.aborted ? { cancelled: true } : {}) };
    } finally {
      deliveries.delete(delivery);
    }
  }

  return {
    send,
    close() {
      closed = true;
      for (const delivery of deliveries) delivery.abort();
    },
  };
}

export type WebhookDispatcher = ReturnType<typeof createWebhookDispatcher>;
