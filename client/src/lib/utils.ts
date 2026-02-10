// Shared utility functions — ported from EJS footer.ejs

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
    }
  } catch {}
  return dateStr;
}

export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${dh}:${m} ${ampm}`;
}

export function formatTimestamp(ts: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts.substring(0, 16);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  const hh = d.getHours(), mm = d.getMinutes();
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const dh = hh > 12 ? hh - 12 : hh === 0 ? 12 : hh;
  const timeStr = `${dh}:${mm < 10 ? '0' : ''}${mm} ${ampm}`;
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  if (diffDay === 1) return `Yesterday at ${timeStr}`;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (diffDay < 7) return `${diffDay} days ago`;
  return `${months[d.getMonth()]} ${d.getDate()} at ${timeStr}`;
}

export function campaignColor(campaign: string): string {
  const colors: Record<string, string> = {
    Aethermoor: '#1a3a5c', Aquabyssos: '#1a4a4a', Terravor: '#8b0000', 'Two Cities': '#b8860b',
  };
  return colors[campaign] || '#c9a959';
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

