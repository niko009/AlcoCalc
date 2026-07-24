import type { DrinkingSession } from "./types";

export const STANDARD_DRINK_GRAMS = 10;

export function toStandardDrinks(alcoholGrams: number) {
  if (!Number.isFinite(alcoholGrams) || alcoholGrams <= 0) return 0;
  return alcoholGrams / STANDARD_DRINK_GRAMS;
}

export type HistoryPeriod = "all" | "7d" | "30d";

export function filterSessionsByPeriod(
  history: DrinkingSession[],
  period: HistoryPeriod,
  now = new Date(),
) {
  if (period === "all") return history;
  const days = period === "7d" ? 7 : 30;
  const threshold = now.getTime() - days * 24 * 60 * 60 * 1000;
  return history.filter((session) => Date.parse(session.startTime) >= threshold);
}

export function calculateHistoryAnalytics(
  history: DrinkingSession[],
  now = new Date(),
) {
  const last7Days = filterSessionsByPeriod(history, "7d", now);
  const last30Days = filterSessionsByPeriod(history, "30d", now);
  const previous30Start = now.getTime() - 60 * 24 * 60 * 60 * 1000;
  const previous30End = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const previous30Days = history.filter((session) => {
    const time = Date.parse(session.startTime);
    return time >= previous30Start && time < previous30End;
  });
  const sumGrams = (sessions: DrinkingSession[]) =>
    sessions.reduce((sum, session) => sum + session.totalAlcoholGrams, 0);
  const daysWithSessions = new Set(
    last30Days.map((session) => new Date(session.startTime).toISOString().slice(0, 10)),
  ).size;
  const maxBac = last30Days.reduce(
    (maximum, session) => Math.max(maximum, session.maxBac),
    0,
  );
  const currentGrams = sumGrams(last30Days);
  const previousGrams = sumGrams(previous30Days);

  return {
    sessions7d: last7Days.length,
    grams7d: sumGrams(last7Days),
    sessions30d: last30Days.length,
    grams30d: currentGrams,
    standardDrinks30d: toStandardDrinks(currentGrams),
    alcoholFreeDays30d: Math.max(0, 30 - daysWithSessions),
    maxBac30d: maxBac,
    changePercent:
      previousGrams > 0
        ? ((currentGrams - previousGrams) / previousGrams) * 100
        : currentGrams > 0
          ? null
          : 0,
  };
}

export function historyToCsv(history: DrinkingSession[]) {
  const escape = (value: string | number | boolean) =>
    `"${String(value).replaceAll('"', '""')}"`;
  const rows = [
    [
      "session_id",
      "start_time",
      "end_time",
      "max_bac_percent",
      "duration_hours",
      "alcohol_grams",
      "standard_drinks_10g",
      "drink_type",
      "volume_ml",
      "abv_percent",
      "quantity",
      "consumed_at",
    ].join(","),
  ];
  for (const session of history) {
    for (const drink of session.drinks) {
      rows.push(
        [
          session.id,
          session.startTime,
          session.endTime,
          session.maxBac,
          session.durationHours,
          session.totalAlcoholGrams,
          toStandardDrinks(session.totalAlcoholGrams).toFixed(2),
          drink.type,
          drink.volumeMl,
          drink.abv,
          drink.quantity,
          drink.time,
        ]
          .map(escape)
          .join(","),
      );
    }
  }
  return `\uFEFF${rows.join("\r\n")}`;
}
