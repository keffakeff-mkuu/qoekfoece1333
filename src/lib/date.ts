export const EAT_TIMEZONE = 'Africa/Nairobi';

export function formatNairobiDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-KE', {
      timeZone: EAT_TIMEZONE,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatNairobiTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-KE', {
      timeZone: EAT_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function todayNairobiDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: EAT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(amount);
}
