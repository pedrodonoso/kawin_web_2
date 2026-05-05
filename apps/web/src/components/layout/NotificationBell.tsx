"use client";

import { useEffect, useRef, useState } from "react";
import Pusher from "pusher-js";
import { Bell } from "lucide-react";
import { notificationsApi, type AppNotification } from "@/lib/api";
import { registerServiceWorker, subscribeToPush } from "@/lib/push";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

function NotifIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    new_booking:        "🎉",
    booking_cancelled:  "❌",
    class_reminder:     "📅",
    workshop_submitted: "📋",
    workshop_approved:  "✅",
    workshop_updated:   "📝",
  };
  return <span className="text-base leading-none">{icons[type] ?? "🔔"}</span>;
}

export function NotificationBell() {
  const [open, setOpen]                   = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread]               = useState(0);
  const containerRef                      = useRef<HTMLDivElement>(null);

  // ── Carga inicial (una sola vez al montar) ────────────────────────────
  // El WebSocket mantiene el estado actualizado en tiempo real;
  // el fetch solo es necesario para hidratar el historial inicial.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await notificationsApi.list();
        if (!cancelled) {
          setNotifications(res.data);
          setUnread(res.unread_count);
        }
      } catch {
        // ignore — user may not be logged in yet
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []); // runs once on mount

  // ── Service Worker + Push subscription (runs once on mount) ───────────
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    registerServiceWorker().then((reg) => {
      if (reg) subscribeToPush(token).catch(() => {});
    });
  }, []); // runs once on mount

  // ── WebSocket via Soketi (runs once on mount) ───────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("token");
    const raw   = localStorage.getItem("user");
    if (!token || !raw) return;

    const user = JSON.parse(raw) as { id: string };

    const pusherPort = Number(process.env.NEXT_PUBLIC_PUSHER_PORT ?? 6001);
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY ?? "kawin-key", {
      wsHost:            process.env.NEXT_PUBLIC_PUSHER_HOST ?? "localhost",
      wsPort:            pusherPort,
      wssPort:           pusherPort,
      cluster:           "mt1", // requerido por pusher-js, ignorado cuando wsHost está definido
      forceTLS:          pusherPort === 443,
      enabledTransports: pusherPort === 443 ? ["wss"] : ["ws"],
      disableStats:      true,
      authorizer: (channel) => ({
        authorize: (socketId: string, callback: import("pusher-js").AuthorizerCallback) => {
          const t = localStorage.getItem("token");
          fetch("/api/v1/broadcasting/auth", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${t}`,
            },
            body: JSON.stringify({ socket_id: socketId, channel_name: channel.name }),
          })
            .then((r) => r.json())
            .then((data) => callback(null, data))
            .catch((err) => callback(err, null));
        },
      }),
    });

    const channel = pusher.subscribe(`private-user.${user.id}`);

    channel.bind("notification", (data: AppNotification["data"]) => {
      setNotifications((prev) => [
        {
          id:         `ws-${Date.now()}`,
          type:       data.type ?? "notification",
          data,
          is_read:    false,
          read_at:    null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setUnread((n) => n + 1);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-user.${user.id}`);
      pusher.disconnect();
    };
  }, []); // runs once on mount

  // ── Close dropdown on outside click ────────────────────────────────────
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []); // runs once on mount

  // ── Handlers ────────────────────────────────────────────────────────────
  async function handleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && unread > 0) {
      setUnread(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      await notificationsApi.markAllRead().catch(() => {});
    }
  }

  async function handleClickNotif(n: AppNotification) {
    if (!n.is_read) {
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
      );
      if (!n.id.startsWith("ws-")) {
        await notificationsApi.markRead(n.id).catch(() => {});
      }
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border bg-background shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-semibold">Notificaciones</span>
            {notifications.some((n) => !n.is_read) && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={async () => {
                  setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                  setUnread(0);
                  await notificationsApi.markAllRead().catch(() => {});
                }}
              >
                Marcar todo leído
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Sin notificaciones
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotif(n)}
                  className={cn(
                    "w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors",
                    !n.is_read && "bg-primary/5"
                  )}
                >
                  <span className="mt-0.5 shrink-0">
                    <NotifIcon type={n.data?.type ?? n.type} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm leading-snug", !n.is_read && "font-medium")}>
                      {n.data?.message ?? "Nueva notificación"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  {!n.is_read && (
                    <span className="mt-1.5 shrink-0 h-2 w-2 rounded-full bg-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
