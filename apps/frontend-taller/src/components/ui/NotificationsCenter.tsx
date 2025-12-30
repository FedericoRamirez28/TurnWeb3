// src/components/ui/NotificationsCenter.tsx
import React, { useEffect, useMemo, useState } from "react";


import bell from "../../../assets/icons/bell.png";
import bellActive from "../../../assets/icons/notification.png";

type NotifLevel = "info" | "warn" | "danger" | "success";

export type MobilNotification = {
  id: string;
  ts: number;
  read: boolean;
  level: NotifLevel;
  title: string;
  message: string;
  meta?: Record<string, any>;
};

const keyFor = (movilId: string | number) => `ts_notifs_${movilId}`;

export function pushMobilNotification(
  movilId: string | number,
  notif: Partial<Omit<MobilNotification, "id" | "ts" | "read">> & { meta?: Record<string, any> }
) {
  try {
    const k = keyFor(movilId);
    const prev = JSON.parse(localStorage.getItem(k) || "[]") as MobilNotification[];

    const already = prev.some(
      (it) =>
        (it.title || "") === (notif.title || "") &&
        (it.message || "") === (notif.message || "") &&
        String((it.meta as any)?.key || "") === String(notif?.meta?.key || "") &&
        String((it.meta as any)?.threshold || "") === String(notif?.meta?.threshold || "")
    );
    if (already) return;

    const item: MobilNotification = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ts: Date.now(),
      read: false,
      level: (notif.level as NotifLevel) || "info",
      title: notif.title || "Notificación",
      message: notif.message || "",
      meta: { ...(notif.meta || {}), threshold: notif?.meta?.threshold || "" },
    };

    localStorage.setItem(k, JSON.stringify([item, ...prev].slice(0, 200)));
    window.dispatchEvent(new CustomEvent("ts:notifs-updated", { detail: { movilId } }));
  } catch (e) {
    console.error("No se pudo guardar notificación", e);
  }
}

export function clearMobilNotifications(movilId: string | number) {
  localStorage.removeItem(keyFor(movilId));
  window.dispatchEvent(new CustomEvent("ts:notifs-updated", { detail: { movilId } }));
}

type Props = {
  movilId: string | number;
  title?: string;
};

export default function NotificationsCenter({ movilId, title = "Notificaciones" }: Props) {
  const storageKey = useMemo(() => keyFor(movilId), [movilId]);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MobilNotification[]>([]);

  const load = () => {
    try {
      const arr = JSON.parse(localStorage.getItem(storageKey) || "[]");
      setItems(Array.isArray(arr) ? (arr as MobilNotification[]) : []);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    load();
    const onUpdate = (e: any) => {
      if (e?.detail?.movilId == null || String(e.detail.movilId) === String(movilId)) load();
    };
    window.addEventListener("ts:notifs-updated", onUpdate);
    return () => window.removeEventListener("ts:notifs-updated", onUpdate);
  }, [storageKey, movilId]);

  const unread = items.filter((i) => !i.read).length;

  const markAllRead = () => {
    const next = items.map((i) => ({ ...i, read: true }));
    localStorage.setItem(storageKey, JSON.stringify(next));
    setItems(next);
  };

  const removeOne = (id: string) => {
    const next = items.filter((i) => i.id !== id);
    localStorage.setItem(storageKey, JSON.stringify(next));
    setItems(next);
  };

  const clearAll = () => {
    clearMobilNotifications(movilId);
    setItems([]);
  };

  return (
    <div className="notif">
      <button
        className={`notif__button ${unread ? "has" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={unread ? `${unread} notificación(es)` : "Sin notificaciones"}
        aria-label="Abrir centro de notificaciones"
      >
        <img src={unread ? bellActive : bell} alt="campana" />
        {unread > 0 && <span className="notif__badge">{unread}</span>}
      </button>

      {open && (
        <div className="notif__panel">
          <div className="notif__head">
            <strong>{title}</strong>
            <div className="notif__actions">
              <button className="btn-ghost" onClick={markAllRead} disabled={!items.length}>
                Marcar leídas
              </button>
              <button className="btn-ghost" onClick={clearAll} disabled={!items.length}>
                Vaciar
              </button>
            </div>
          </div>

          {!items.length && <div className="notif__empty">🔔 No hay notificaciones</div>}

          <ul className="notif__list">
            {items.map((n) => (
              <li key={n.id} className={`notif__item ${n.level} ${n.read ? "read" : ""}`}>
                <div className="notif__item__main">
                  <div className="notif__item__title">{n.title}</div>
                  {n.message && <div className="notif__item__msg">{n.message}</div>}
                  <div className="notif__item__time">{new Date(n.ts).toLocaleString()}</div>
                </div>

                <div className="notif__item__right">
                  {!n.read && (
                    <button
                      className="chip"
                      onClick={() => {
                        const next = items.map((i) => (i.id === n.id ? { ...i, read: true } : i));
                        localStorage.setItem(storageKey, JSON.stringify(next));
                        setItems(next);
                      }}
                    >
                      Marcar leída
                    </button>
                  )}
                  <button className="chip danger" onClick={() => removeOne(n.id)}>
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
