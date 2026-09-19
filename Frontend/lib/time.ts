/**
 * Shared time helpers.
 *
 * Storage / API contract: "HH:mm" 24-hour (e.g. "16:00").
 * Display contract: Arabic 12-hour (e.g. "04:00 م").
 */

export type DayPeriod = "AM" | "PM";

export function parseHHmm(value: string): {
  hour24: number;
  minute: number;
} | null {
  const match =
    /^(\d{1,2}):(\d{2})$/.exec(
      value.trim(),
    );

  if (!match) {
    return null;
  }

  const hour24 = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour24) ||
    !Number.isInteger(minute) ||
    hour24 < 0 ||
    hour24 > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return { hour24, minute };
}

export function toHHmm(
  hour24: number,
  minute: number,
): string {
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function toHour12(hour24: number): {
  hour12: number;
  period: DayPeriod;
} {
  return {
    hour12:
      hour24 % 12 === 0 ? 12 : hour24 % 12,
    period: hour24 >= 12 ? "PM" : "AM",
  };
}

export function toHour24(
  hour12: number,
  period: DayPeriod,
): number {
  if (period === "AM") {
    return hour12 === 12 ? 0 : hour12;
  }

  return hour12 === 12 ? 12 : hour12 + 12;
}

/**
 * Format "HH:mm" as Arabic 12-hour ("04:00 م").
 * Unknown formats pass through unchanged (legacy data safety).
 */
export function formatTime12(
  value: string,
): string {
  const parsed = parseHHmm(value);

  if (!parsed) {
    return value;
  }

  const { hour12, period } = toHour12(
    parsed.hour24,
  );

  return `${String(hour12).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")} ${
    period === "PM" ? "م" : "ص"
  }`;
}
