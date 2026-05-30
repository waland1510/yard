// Transient toast queue. Single subscribe API. HUD renders the queue; producers don't
// know who is listening. Pure-ish (no React; just a tiny pub/sub).

export type NotificationKind = 'info' | 'success' | 'warning' | 'error' | 'capture' | 'reveal';

export interface Notification {
  id: number;
  kind: NotificationKind;
  message: string;
  /** Auto-dismiss after this many ms. 0 = sticky (caller must dismiss). */
  ttlMs: number;
  createdAt: number;
}

export interface NotificationService {
  list(): readonly Notification[];
  push(kind: NotificationKind, message: string, ttlMs?: number): number;
  dismiss(id: number): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
}

const DEFAULT_TTL: Record<NotificationKind, number> = {
  info: 3500,
  success: 3500,
  warning: 5000,
  error: 6000,
  capture: 8000,
  reveal: 4500,
};

export function createNotificationService(): NotificationService {
  let queue: Notification[] = [];
  let nextId = 1;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const l of listeners) l();
  };

  return {
    list: () => queue,
    push(kind, message, ttlMs) {
      const id = nextId++;
      const now = performance.now();
      const ttl = ttlMs ?? DEFAULT_TTL[kind];
      const n: Notification = { id, kind, message, ttlMs: ttl, createdAt: now };
      queue = [...queue, n];
      notify();
      if (ttl > 0) {
        setTimeout(() => {
          // Only dismiss if still present (not manually cleared)
          if (queue.some((x) => x.id === id)) {
            queue = queue.filter((x) => x.id !== id);
            notify();
          }
        }, ttl);
      }
      return id;
    },
    dismiss(id) {
      const before = queue.length;
      queue = queue.filter((n) => n.id !== id);
      if (queue.length !== before) notify();
    },
    clear() {
      if (queue.length === 0) return;
      queue = [];
      notify();
    },
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

/** Singleton convenience — most callers don't need their own instance. */
export const notifications = createNotificationService();
