export const universityTimeZone = () => (
  process.env.UNIVERSITY_TIME_ZONE || "Asia/Phnom_Penh"
);

export function isValidCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function getLocalDateTimeParts(value, timeZone = universityTimeZone()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(value);
  return Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
}

export function localDateTimeToDate(date, time, timeZone = universityTimeZone()) {
  const requestedUtc = Date.parse(`${date}T${time}:00.000Z`);
  let candidate = requestedUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = getLocalDateTimeParts(new Date(candidate), timeZone);
    const representedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    candidate = requestedUtc - (representedUtc - candidate);
  }
  return new Date(candidate);
}

export function getLocalDate(value, timeZone = universityTimeZone()) {
  const parts = getLocalDateTimeParts(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getMinutesInTimeZone(value, timeZone = universityTimeZone()) {
  const parts = getLocalDateTimeParts(value, timeZone);
  return Number(parts.hour) * 60 + Number(parts.minute);
}

export function timeToMinutes(value) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

export function isValidMeetingDate(date) {
  if (!isValidCalendarDate(date)) return false;
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return weekday >= 1 && weekday <= 5 && date >= getLocalDate(new Date());
}

export function isFutureMeetingStart(date, time) {
  const today = getLocalDate(new Date());
  return isValidMeetingDate(date) &&
    isValidTime(time) &&
    (date > today || timeToMinutes(time) > getMinutesInTimeZone(new Date()));
}

export function getAvailableSlotStarts(busyRanges, date) {
  const slots = [];
  const today = getLocalDate(new Date());
  const currentMinute = date === today ? getMinutesInTimeZone(new Date()) : -1;
  for (let start = 9 * 60; start <= 16 * 60; start += 30) {
    if (start <= currentMinute) continue;
    const end = start + 60;
    if (busyRanges.some((range) => range.start < end && range.end > start)) continue;
    const hours = String(Math.floor(start / 60)).padStart(2, "0");
    const minutes = String(start % 60).padStart(2, "0");
    slots.push(`${hours}:${minutes}`);
  }
  return slots;
}
