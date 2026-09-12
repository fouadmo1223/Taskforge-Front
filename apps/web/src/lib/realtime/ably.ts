import * as Ably from 'ably';
import type { RealtimeEvent, RealtimeMessage } from '@flowdesk/types';
import { env } from '@/lib/env';
import { useAuth } from '@/features/auth/auth.store';

type Handler = (msg: RealtimeMessage) => void;

/** Returns a token good for at least a few more seconds, refreshing first if needed. */
async function ensureFreshAccessToken(): Promise<string | null> {
  const { accessToken, expiresAt } = useAuth.getState();
  if (accessToken && (!expiresAt || expiresAt > Date.now() + 5_000)) return accessToken;
  const ok = await useAuth.getState().refresh().catch(() => false);
  return ok ? useAuth.getState().accessToken : null;
}

/**
 * Managed realtime via Ably (replaces the Socket.IO client). Same surface as
 * before so the `useRoom` / `useRealtimeEvent` hooks are unchanged:
 * `connect`/`disconnect`, `join`/`leave` a channel, `on(event, handler)`.
 * Authorisation is a short-lived token minted by `POST /realtime/token`, scoped
 * to exactly the channels the user may attach to.
 */
class RealtimeClient {
  private client: Ably.Realtime | null = null;
  private readonly handlers = new Map<RealtimeEvent, Set<Handler>>();
  // Channels we've already called .subscribe() on — purely to avoid registering the
  // same listener twice. NOT used to decide whether publish/dispatch is possible:
  // Ably's own channel registry (client.channels.get) is the durable, always-correct
  // source of truth for that, and channel.publish() auto-attaches as needed.
  private readonly subscribed = new Set<string>();
  private readonly joined = new Set<string>();

  connect(): void {
    if (this.client) return;
    this.client = new Ably.Realtime({
      authCallback: (_params, cb) => {
        // Ably calls this whenever it (re)connects — which can land well after our own
        // short-lived access token has expired (a stale/expired token here means the
        // backend 401s, Ably counts that as an auth failure, and the connection gets
        // stuck disconnected/suspended until refreshed some day at the next retry — the
        // exact "realtime silently stops working" bug). So make sure the token is fresh
        // before asking for an Ably token, refreshing it ourselves if it's missing or
        // about to expire rather than trusting whatever happens to be in the store.
        void ensureFreshAccessToken()
          .then((token) =>
            fetch(`${env.apiUrl}/realtime/token`, {
              method: 'POST',
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              credentials: 'include',
            }),
          )
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`token ${r.status}`))))
          // `/realtime/token` is @RawResponse() — the body IS the Ably token request,
          // not wrapped in the usual `{ data }` envelope. Passing `body.data` here (always
          // `undefined`) is why Ably reported "authentication provider request failed"
          // on every single connection attempt — realtime chat never actually worked.
          .then((body: Ably.TokenRequest) => cb(null, body))
          .catch((err: Error) => cb(err.message, null));
      },
      // don't spam when realtime isn't configured server-side
      disconnectedRetryTimeout: 20_000,
      suspendedRetryTimeout: 60_000,
      logLevel: 0,
    });
    // re-attach channels after a reconnect
    this.client.connection.on('connected', () => {
      for (const name of this.joined) this.attach(name);
    });
  }

  disconnect(): void {
    this.client?.close();
    this.client = null;
    this.subscribed.clear();
    this.joined.clear();
  }

  /** Re-mint the token (call after an access-token refresh). */
  reauth(): void {
    this.client?.auth.authorize().catch(() => undefined);
  }

  join(channelName: string): void {
    this.joined.add(channelName);
    if (this.client) this.attach(channelName);
  }

  leave(channelName: string): void {
    this.joined.delete(channelName);
    this.subscribed.delete(channelName);
    const ch = this.client?.channels.get(channelName);
    if (ch) void ch.detach().catch(() => undefined);
  }

  on(event: RealtimeEvent, handler: Handler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  /** Publish (used for low-stakes client events like chat typing). */
  publish(channelName: string, event: RealtimeEvent, payload: unknown): void {
    // Always go straight to Ably's own channel registry rather than some bookkeeping
    // map of ours — channel.publish() attaches on demand, and Ably's registry is the
    // one thing that can't fall out of sync with reality after a reconnect.
    const ch = this.client?.channels.get(channelName);
    void ch
      ?.publish(event, {
        event,
        room: channelName,
        actorId: useAuth.getState().user?.id ?? null,
        at: new Date().toISOString(),
        payload,
      } satisfies RealtimeMessage)
      .catch(() => undefined);
  }

  private attach(channelName: string, attempt = 0): void {
    if (!this.client || !this.joined.has(channelName) || this.subscribed.has(channelName)) return;
    const ch = this.client.channels.get(channelName);
    this.subscribed.add(channelName);
    ch.subscribe((message) => {
      const msg = message.data as RealtimeMessage;
      this.handlers.get(msg.event)?.forEach((h) => h(msg));
    }).catch(() => {
      // The listener registration itself can fail (e.g. the very first attach attempt
      // right as the connection is still coming up) and does NOT durably survive that —
      // unlike publish(), which always goes straight to Ably's own channel registry,
      // this callback stops receiving anything until we register it again. Un-mark and
      // retry with backoff so a transient failure here doesn't silently disable
      // realtime delivery for the rest of the session.
      this.subscribed.delete(channelName);
      if (attempt < 5) setTimeout(() => this.attach(channelName, attempt + 1), Math.min(1000 * 2 ** attempt, 15_000));
    });
  }
}

export const realtime = new RealtimeClient();
