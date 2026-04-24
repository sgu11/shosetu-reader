import { createRedisConnection, getRedisClient, isRedisConfigured } from "./client";
import { logger } from "@/lib/logger";

type Handler = (msg: string) => void;
type SubClient = Awaited<ReturnType<typeof createRedisConnection>>;

let sharedSub: SubClient | null = null;
let sharedSubPromise: Promise<SubClient> | null = null;
const handlersByChannel = new Map<string, Set<Handler>>();

async function getSharedSub(): Promise<SubClient> {
  if (sharedSub) return sharedSub;
  if (!sharedSubPromise) {
    sharedSubPromise = createRedisConnection().then((client) => {
      sharedSub = client;
      return client;
    }).catch((err) => {
      sharedSubPromise = null;
      throw err;
    });
  }
  return sharedSubPromise;
}

export async function publishToChannel(
  channel: string,
  payload: unknown,
): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    const client = await getRedisClient();
    await client.publish(channel, JSON.stringify(payload));
  } catch (err) {
    logger.warn("Redis publish failed (non-fatal)", {
      channel,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Subscribe to a pub/sub channel via a single shared Redis connection with
 * per-channel refcounted handlers. Prior design opened a socket per
 * subscriber (one per SSE tab) and leaked when clients force-closed.
 */
export async function subscribeToChannel(
  channel: string,
  onMessage: Handler,
): Promise<() => Promise<void>> {
  const sub = await getSharedSub();

  let handlers = handlersByChannel.get(channel);
  if (!handlers) {
    handlers = new Set();
    handlersByChannel.set(channel, handlers);
    await sub.subscribe(channel, (message: string) => {
      const current = handlersByChannel.get(channel);
      if (!current) return;
      for (const h of current) {
        try {
          h(message);
        } catch (err) {
          logger.warn("Redis subscribe callback error", {
            channel,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
    });
  }
  handlers.add(onMessage);

  let released = false;
  return async () => {
    if (released) return;
    released = true;
    const current = handlersByChannel.get(channel);
    if (!current) return;
    current.delete(onMessage);
    if (current.size === 0) {
      handlersByChannel.delete(channel);
      try {
        await sub.unsubscribe(channel);
      } catch {
        // ignore
      }
    }
  };
}

export function episodeEventChannel(episodeId: string): string {
  return `shosetu:events:episode:${episodeId}`;
}
