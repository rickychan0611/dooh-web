type ScheduledItem = {
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  weekdays?: number[] | null;
  start_time?: string | null;
  end_time?: string | null;
};

const WEEKDAY_NUMBER: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function localClock(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    weekday: WEEKDAY_NUMBER[value("weekday")] ?? 0,
    time: `${value("hour")}:${value("minute")}:${value("second")}`,
  };
}

export function isPlaylistItemActive(
  item: ScheduledItem,
  now = new Date(),
  timezone = "America/Vancouver",
) {
  if (item.is_active === false) return false;
  if (item.starts_at && now < new Date(item.starts_at)) return false;
  if (item.ends_at && now >= new Date(item.ends_at)) return false;

  const local = localClock(now, timezone);
  const weekdays = item.weekdays?.length
    ? item.weekdays
    : [0, 1, 2, 3, 4, 5, 6];
  if (!weekdays.includes(local.weekday)) return false;

  const start = item.start_time?.slice(0, 8);
  const end = item.end_time?.slice(0, 8);
  if (!start && !end) return true;
  if (start && !end) return local.time >= start;
  if (!start && end) return local.time < end;
  if (!start || !end) return true;
  if (start <= end) return local.time >= start && local.time < end;
  return local.time >= start || local.time < end;
}
