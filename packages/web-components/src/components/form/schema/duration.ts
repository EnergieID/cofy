/** The units a duration is entered in, smallest first. */
export const DURATION_UNITS = ["seconds", "minutes", "hours", "days", "weeks", "months", "years"] as const;

export type DurationUnit = (typeof DURATION_UNITS)[number];

/** A duration of a whole number of one unit - `PT15M`, `P1D` - the only kind entered here. */
export interface SimpleDuration {
  amount: number;
  unit: DurationUnit;
}

/** Each unit's ISO 8601 designator, and whether it is a time component (after the `T`). */
const DESIGNATORS: Record<DurationUnit, { letter: string; time: boolean }> = {
  seconds: { letter: "S", time: true },
  minutes: { letter: "M", time: true },
  hours: { letter: "H", time: true },
  days: { letter: "D", time: false },
  weeks: { letter: "W", time: false },
  months: { letter: "M", time: false },
  years: { letter: "Y", time: false },
};

const SIMPLE = /^P(?:(\d+)([YMWD])|T(\d+)([HMS]))$/;

/** *value* as a whole number of one unit, or `undefined` where it is anything else - several components, a fraction. */
export function parseDuration(value: string): SimpleDuration | undefined {
  const match = SIMPLE.exec(value);
  if (match === null) return undefined;
  const [, dateAmount, dateLetter, timeAmount, timeLetter] = match;
  const time = timeLetter !== undefined;
  const letter = time ? timeLetter : dateLetter;
  const unit = DURATION_UNITS.find((candidate) => DESIGNATORS[candidate].letter === letter && DESIGNATORS[candidate].time === time)!;
  return { amount: Number(time ? timeAmount : dateAmount), unit };
}

/** *duration* written as an ISO 8601 duration. */
export function formatDuration({ amount, unit }: SimpleDuration): string {
  const { letter, time } = DESIGNATORS[unit];
  return time ? `PT${amount}${letter}` : `P${amount}${letter}`;
}
