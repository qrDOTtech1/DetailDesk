import { addMinutes } from "date-fns";

/** Offset (ms) of `timeZone` vs UTC at instant `date`. */
function tzOffsetMs(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUTC - date.getTime();
}

/** Convert a wall-clock time (YYYY-MM-DD + HH:mm) in `timeZone` to a UTC Date. */
export function zonedToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const naive = new Date(Date.UTC(y, m - 1, d, hh, mm));
  // two-pass to handle DST edges
  let utc = new Date(naive.getTime() - tzOffsetMs(naive, timeZone));
  utc = new Date(naive.getTime() - tzOffsetMs(utc, timeZone));
  return utc;
}

type Interval = { start: Date; end: Date };

export type SlotInput = {
  date: string; // YYYY-MM-DD (business timezone)
  timezone: string;
  durationMinutes: number;
  bufferMinutes: number;
  noticeHours: number;
  rules: { weekday: number; start_time: string; end_time: string }[];
  busy: Interval[]; // existing bookings + blocked slots (UTC)
  stepMinutes?: number;
};

/** Returns available slot start times (UTC Dates) for one day. */
export function computeSlots(input: SlotInput): Date[] {
  const step = input.stepMinutes ?? 30;
  // weekday of that calendar day in the business tz
  const localNoon = zonedToUtc(input.date, "12:00", input.timezone);
  const dayOfWeek = new Intl.DateTimeFormat("en-US", { timeZone: input.timezone, weekday: "short" })
    .format(localNoon);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const wd = map[dayOfWeek] ?? localNoon.getUTCDay();

  const dayRules = input.rules.filter((r) => r.weekday === wd);
  if (dayRules.length === 0) return [];

  const minStart = new Date(Date.now() + input.noticeHours * 3600_000);
  const total = input.durationMinutes + input.bufferMinutes;
  const slots: Date[] = [];

  for (const rule of dayRules) {
    const open = zonedToUtc(input.date, rule.start_time.slice(0, 5), input.timezone);
    const close = zonedToUtc(input.date, rule.end_time.slice(0, 5), input.timezone);
    for (let t = open; addMinutes(t, input.durationMinutes) <= close; t = addMinutes(t, step)) {
      if (t < minStart) continue;
      const end = addMinutes(t, total);
      const overlaps = input.busy.some((b) => t < b.end && end > b.start);
      if (!overlaps) slots.push(t);
    }
  }
  return slots.sort((a, b) => a.getTime() - b.getTime());
}
