"use client";

import {
  parseHHmm,
  toHHmm,
  toHour12,
  toHour24,
  type DayPeriod,
} from "@/lib/time";

type TimePickerProps = {
  /** 24-hour "HH:mm" string, or "" when unset. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Minute granularity. Defaults to 5. */
  minuteStep?: number;
  id?: string;
};

function selectedParts(value: string): {
  hour12: number | null;
  minute: number | null;
  period: DayPeriod | null;
} {
  const parsed = parseHHmm(value);

  if (!parsed) {
    return {
      hour12: null,
      minute: null,
      period: null,
    };
  }

  const { hour12, period } = toHour12(
    parsed.hour24,
  );

  return {
    hour12,
    minute: parsed.minute,
    period,
  };
}

export default function TimePicker({
  value,
  onChange,
  disabled = false,
  minuteStep = 5,
  id,
}: TimePickerProps) {
  const { hour12, minute, period } =
    selectedParts(value);

  const hours = Array.from(
    { length: 12 },
    (_, index) => index + 1,
  );

  const minutes: number[] = [];

  for (
    let current = 0;
    current < 60;
    current += Math.max(1, minuteStep)
  ) {
    minutes.push(current);
  }

  const emit = (
    nextHour12: number | null,
    nextMinute: number | null,
    nextPeriod: DayPeriod | null,
  ) => {
    const resolvedHour12 =
      nextHour12 ?? hour12 ?? 12;

    const resolvedMinute =
      nextMinute ?? minute ?? 0;

    const resolvedPeriod =
      nextPeriod ?? period ?? "PM";

    onChange(
      toHHmm(
        toHour24(
          resolvedHour12,
          resolvedPeriod,
        ),
        resolvedMinute,
      ),
    );
  };

  const selectClassName =
    "h-11 rounded-xl border border-slate-200 bg-white px-2 text-center text-sm font-semibold text-slate-700 outline-none transition focus:border-[#1748EF] focus:ring-4 focus:ring-[#1748EF]/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

  return (
    <div
      className="flex items-stretch gap-2"
      dir="ltr"
    >
      <select
        id={id}
        aria-label="الساعة"
        value={hour12 ?? ""}
        disabled={disabled}
        onChange={(event) =>
          emit(
            event.target.value
              ? Number(event.target.value)
              : null,
            minute,
            period,
          )
        }
        className={`${selectClassName} flex-1`}
      >
        <option value="">
          ساعة
        </option>

        {hours.map((hour) => (
          <option
            key={hour}
            value={hour}
          >
            {String(hour).padStart(
              2,
              "0",
            )}
          </option>
        ))}
      </select>

      <span
        aria-hidden
        className="flex items-center text-lg font-bold text-slate-300"
      >
        :
      </span>

      <select
        aria-label="الدقيقة"
        value={minute ?? ""}
        disabled={disabled}
        onChange={(event) =>
          emit(
            hour12,
            event.target.value
              ? Number(event.target.value)
              : null,
            period,
          )
        }
        className={`${selectClassName} flex-1`}
      >
        <option value="">
          دقيقة
        </option>

        {minutes.map((item) => (
          <option
            key={item}
            value={item}
          >
            {String(item).padStart(
              2,
              "0",
            )}
          </option>
        ))}
      </select>

      <select
        aria-label="الفترة"
        value={period ?? ""}
        disabled={disabled}
        onChange={(event) =>
          emit(
            hour12,
            minute,
            (event.target.value as DayPeriod) ||
              null,
          )
        }
        className={`${selectClassName} w-20 shrink-0`}
      >
        <option value="">
          ص/م
        </option>

        <option value="AM">صباحًا</option>

        <option value="PM">مساءً</option>
      </select>
    </div>
  );
}
