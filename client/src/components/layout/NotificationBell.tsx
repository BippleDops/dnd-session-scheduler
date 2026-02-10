'use client';
import { useState, useEffect } from 'react';
import { getMyNotifications, markAllNotificationsRead, type Notification } from '@/lib/api';
import { formatTimestamp } from '@/lib/utils';

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getMyNotifications().then(d => {
      setUnread(d.unread);
      setNotifications(d.notifications);
    }).catch(() => {});
  }, []);

  const markAll = () => {
    markAllNotificationsRead().then(() => {
      setUnread(0);
      setNotifications([]);
      setOpen(false);
    });
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="text-lg bg-transparent border-none cursor-pointer relative">
        🔔
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 max-h-96 overflow-y-auto bg-[var(--wood-medium)] border border-[var(--gold)] rounded-lg shadow-xl z-50 p-2">
          <div className="flex justify-between items-center px-2 py-1 border-b border-[rgba(201,169,89,0.3)]">
            <span className="text-[var(--gold)] text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-[var(--parchment-dark)] hover:text-[var(--gold)] bg-transparent border-none cursor-pointer">
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-center text-sm text-[var(--ink-faded)] py-4 italic">
              The messenger has nothing for you, adventurer.
            </p>
          ) : (
            notifications.map(n => (
              <div key={n.notification_id} className="px-2 py-2 border-b border-[rgba(255,255,255,0.05)] text-sm">
                <p className="text-[var(--parchment)]">{n.message}</p>
                <p className="text-xs text-[var(--ink-faded)] mt-1">{formatTimestamp(n.created_at)}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

