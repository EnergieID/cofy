/** A `format: date-time` value taken apart into what a reader enters separately. */
export interface DateTimeParts {
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm:ss`, or `HH:mm`. */
  time: string;
  sign: "+" | "-";
  /** The offset from UTC, as `HH:mm`. */
  offset: string;
}

const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|([+-])(\d{2}:\d{2}))?$/i;

/**
 * *value* taken apart, or `undefined` where it is not a date-time at all. One without an offset gets the reader's own
 * for that date, as does `undefined` itself - a field with nothing in it yet.
 */
export function parseDateTime(value: unknown): DateTimeParts | undefined {
  if (value === null || value === undefined || value === "") return emptyDateTime();
  if (typeof value !== "string") return undefined;

  const match = DATE_TIME.exec(value);
  if (match === null) return undefined;
  const [, date, time, zone, sign, offset] = match;
  if (zone === undefined) return { date: date!, time: time!, ...localOffset(`${date}T${time}`) };
  if (sign === undefined) return { date: date!, time: time!, sign: "+", offset: "00:00" };
  return { date: date!, time: time!, sign: sign as "+" | "-", offset: offset! };
}

/** A date-time with nothing entered yet, at the reader's own offset for now. */
export function emptyDateTime(): DateTimeParts {
  return { date: "", time: "", ...localOffset("") };
}

/** *parts* put back together as a date-time with an offset, or `null` while there is no date - the one part with no default. */
export function formatDateTime(parts: DateTimeParts): string | null {
  if (parts.date === "") return null;
  const time = parts.time === "" ? "00:00:00" : parts.time.length === 5 ? `${parts.time}:00` : parts.time;
  return `${parts.date}T${time}${parts.sign}${parts.offset}`;
}

/** The reader's own offset from UTC at *localDateTime* (or now, given `""`), which differs between summer and winter. */
export function localOffset(localDateTime: string): Pick<DateTimeParts, "sign" | "offset"> {
  const at = localDateTime === "" ? new Date() : new Date(localDateTime);
  const minutes = -at.getTimezoneOffset();
  const absolute = Math.abs(minutes);
  const offset = `${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
  return { sign: minutes < 0 ? "-" : "+", offset };
}
