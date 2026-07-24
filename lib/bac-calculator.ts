import type { Drink, FoodLevel, SessionSettings } from "./types";

export const ETHANOL_DENSITY_G_PER_ML = 0.789;
export const ELIMINATION_RATE_BAC_PER_HOUR = 0.015;
export const DEFAULT_ABSORPTION_MINUTES = 45;
export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  foodLevel: "light",
  eliminationRate: ELIMINATION_RATE_BAC_PER_HOUR,
};

const FOOD_ABSORPTION_MINUTES: Record<FoodLevel, number> = {
  empty: 30,
  light: 60,
  full: 90,
};

export function getAbsorptionMinutes(foodLevel: FoodLevel) {
  return FOOD_ABSORPTION_MINUTES[foodLevel];
}

export function calculateAlcoholGrams(volumeMl: number, abv: number): number {
  if (
    !Number.isFinite(volumeMl) ||
    !Number.isFinite(abv) ||
    volumeMl <= 0 ||
    abv <= 0
  ) {
    return 0;
  }
  return volumeMl * (abv / 100) * ETHANOL_DENSITY_G_PER_ML;
}

export function calculatePermille(bac: number): number {
  return Math.max(0, bac * 10);
}

export type IntoxicationLevel = {
  label: string;
  color: string;
  description: string;
  effects: string;
};

const LEVELS: Array<IntoxicationLevel & { min: number; max: number }> = [
  {
    label: "Трезвый",
    min: 0,
    max: 0.02,
    color: "#10b981",
    description: "Видимых признаков влияния алкоголя обычно нет.",
    effects: "Расчёт справочный: только алкотестер может измерить BAC.",
  },
  {
    label: "Лёгкое опьянение",
    min: 0.02,
    max: 0.05,
    color: "#84cc16",
    description: "Возможны расслабление и снижение концентрации.",
    effects: "Реакция и оценка ситуации уже могут ухудшаться.",
  },
  {
    label: "Заметное опьянение",
    min: 0.05,
    max: 0.08,
    color: "#f59e0b",
    description: "Вероятны заметные изменения реакции и координации.",
    effects: "Не управляйте транспортом и механизмами.",
  },
  {
    label: "Сильное опьянение",
    min: 0.08,
    max: 0.15,
    color: "#f97316",
    description: "Возможны нарушения речи, равновесия и реакции.",
    effects: "Вождение категорически запрещено.",
  },
  {
    label: "Тяжёлое опьянение",
    min: 0.15,
    max: 0.25,
    color: "#ef4444",
    description: "Высокий риск дезориентации, травм и отравления.",
    effects: "Не оставляйте человека одного; следите за состоянием.",
  },
  {
    label: "Опасное состояние",
    min: 0.25,
    max: Number.POSITIVE_INFINITY,
    color: "#7f1d1d",
    description: "Возможна алкогольная кома и угнетение дыхания.",
    effects: "При потере сознания или проблемах с дыханием вызывайте 112.",
  },
];

export function getIntoxicationLevel(bac: number): IntoxicationLevel {
  return LEVELS.find((level) => bac >= level.min && bac < level.max) ?? LEVELS[0];
}

/**
 * Piecewise Widmark estimate with linear absorption and one elimination rate
 * for the person's total BAC. Earlier versions incorrectly eliminated alcohol
 * once per drink, which made several overlapping drinks disappear too fast.
 */
export function calculateDynamicBAC(
  drinks: Drink[],
  weightKg: number,
  r: number,
  targetTime: Date,
  absorptionMinutes = DEFAULT_ABSORPTION_MINUTES,
  eliminationRate = ELIMINATION_RATE_BAC_PER_HOUR,
): number {
  if (
    drinks.length === 0 ||
    !Number.isFinite(weightKg) ||
    !Number.isFinite(r) ||
    weightKg <= 0 ||
    r <= 0
  ) {
    return 0;
  }
  const targetMs = targetTime.getTime();
  if (!Number.isFinite(targetMs)) return 0;

  const absorptionHours = Math.max(1, absorptionMinutes) / 60;
  const events: Array<{ timeMs: number; absorptionRate: number }> = [];

  for (const drink of drinks) {
    const startMs = new Date(drink.time).getTime();
    if (!Number.isFinite(startMs) || startMs > targetMs) continue;
    if (!Number.isFinite(drink.quantity) || drink.quantity <= 0) continue;
    const grams = calculateAlcoholGrams(drink.volumeMl, drink.abv) * drink.quantity;
    if (grams <= 0) continue;
    const peakBac = (grams / (weightKg * r * 1000)) * 100;
    const absorptionRate = peakBac / absorptionHours;
    events.push({ timeMs: startMs, absorptionRate });
    events.push({
      timeMs: startMs + absorptionHours * 3_600_000,
      absorptionRate: -absorptionRate,
    });
  }

  if (events.length === 0) return 0;
  events.sort((a, b) => a.timeMs - b.timeMs);

  let bac = 0;
  let activeAbsorptionRate = 0;
  let previousMs = events[0].timeMs;
  let index = 0;

  const advance = (elapsedHours: number) => {
    const safeEliminationRate =
      Number.isFinite(eliminationRate) && eliminationRate > 0
        ? eliminationRate
        : ELIMINATION_RATE_BAC_PER_HOUR;
    const elimination =
      bac > 0 || activeAbsorptionRate > safeEliminationRate
        ? safeEliminationRate
        : 0;
    bac = Math.max(0, bac + (activeAbsorptionRate - elimination) * elapsedHours);
  };

  while (index < events.length && events[index].timeMs <= targetMs) {
    const eventMs = events[index].timeMs;
    advance((eventMs - previousMs) / 3_600_000);
    while (index < events.length && events[index].timeMs === eventMs) {
      activeAbsorptionRate += events[index].absorptionRate;
      index += 1;
    }
    previousMs = eventMs;
  }
  if (previousMs < targetMs) advance((targetMs - previousMs) / 3_600_000);
  return bac < 1e-10 ? 0 : bac;
}

export function calculateSobrietyTime(
  drinks: Drink[],
  weightKg: number,
  r: number,
  fromTime = new Date(),
  absorptionMinutes = DEFAULT_ABSORPTION_MINUTES,
  eliminationRate = ELIMINATION_RATE_BAC_PER_HOUR,
): Date {
  if (drinks.length === 0) return new Date(fromTime);
  const times = drinks.map((drink) => Date.parse(drink.time)).filter(Number.isFinite);
  if (times.length === 0) return new Date(fromTime);
  const absorptionEnd = Math.max(...times) + absorptionMinutes * 60_000;
  const grams = drinks.reduce(
    (sum, drink) =>
      sum + calculateAlcoholGrams(drink.volumeMl, drink.abv) * drink.quantity,
    0,
  );
  const peak = weightKg > 0 && r > 0 ? (grams / (weightKg * r * 1000)) * 100 : 0;
  const safeEnd =
    Math.max(fromTime.getTime(), absorptionEnd) +
    (peak / Math.max(0.001, eliminationRate) + 2) * 3_600_000;

  for (
    let current = Math.max(fromTime.getTime(), Math.min(...times));
    current <= safeEnd;
    current += 60_000
  ) {
    if (
      current >= absorptionEnd &&
      calculateDynamicBAC(
        drinks,
        weightKg,
        r,
        new Date(current),
        absorptionMinutes,
        eliminationRate,
      ) === 0
    ) {
      return new Date(current);
    }
  }
  return new Date(safeEnd);
}

export function calculateForecast(
  drinks: Drink[],
  weightKg: number,
  r: number,
  fromTime = new Date(),
  settings = DEFAULT_SESSION_SETTINGS,
) {
  if (drinks.length === 0) {
    return {
      peakBac: 0,
      peakTime: new Date(fromTime),
      nearZeroTime: new Date(fromTime),
    };
  }

  const absorptionMinutes = getAbsorptionMinutes(settings.foodLevel);
  const soberAt = calculateSobrietyTime(
    drinks,
    weightKg,
    r,
    fromTime,
    absorptionMinutes,
    settings.eliminationRate,
  );
  let peakBac = 0;
  let peakTime = new Date(fromTime);
  let peakPassed = false;
  let nearZeroTime = soberAt;

  for (
    let current = fromTime.getTime();
    current <= soberAt.getTime();
    current += 60_000
  ) {
    const bac = calculateDynamicBAC(
      drinks,
      weightKg,
      r,
      new Date(current),
      absorptionMinutes,
      settings.eliminationRate,
    );
    if (bac >= peakBac) {
      peakBac = bac;
      peakTime = new Date(current);
    } else if (current > peakTime.getTime()) {
      peakPassed = true;
    }
    if (peakPassed && bac <= 0.005) {
      nearZeroTime = new Date(current);
      break;
    }
  }

  return { peakBac, peakTime, nearZeroTime };
}

export type TimelinePoint = { time: string; bac: number; permille: number };

export function generateBACTimeline(
  drinks: Drink[],
  weightKg: number,
  r: number,
  intervalMinutes = 15,
  settings = DEFAULT_SESSION_SETTINGS,
): TimelinePoint[] {
  if (drinks.length === 0) return [];
  const times = drinks.map((drink) => Date.parse(drink.time));
  const first = Math.min(...times);
  const absorptionMinutes = getAbsorptionMinutes(settings.foodLevel);
  const end = calculateSobrietyTime(
    drinks,
    weightKg,
    r,
    new Date(first),
    absorptionMinutes,
    settings.eliminationRate,
  ).getTime();
  const points: TimelinePoint[] = [];
  for (
    let current = first, count = 0;
    current <= end + intervalMinutes * 60_000 && count < 500;
    current += intervalMinutes * 60_000, count += 1
  ) {
    const date = new Date(current);
    const bac = calculateDynamicBAC(
      drinks,
      weightKg,
      r,
      date,
      absorptionMinutes,
      settings.eliminationRate,
    );
    points.push({
      time: date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      bac: Number(bac.toFixed(4)),
      permille: Number(calculatePermille(bac).toFixed(3)),
    });
  }
  return points;
}

export function calculateSessionStats(
  drinks: Drink[],
  weightKg: number,
  r: number,
  settings = DEFAULT_SESSION_SETTINGS,
) {
  const times = drinks.map((drink) => Date.parse(drink.time));
  const startTime = new Date(Math.min(...times)).toISOString();
  const endTime = new Date(Math.max(...times)).toISOString();
  const absorptionMinutes = getAbsorptionMinutes(settings.foodLevel);
  const sobriety = calculateSobrietyTime(
    drinks,
    weightKg,
    r,
    new Date(startTime),
    absorptionMinutes,
    settings.eliminationRate,
  );
  let maxBac = 0;
  for (let time = Math.min(...times); time <= sobriety.getTime(); time += 5 * 60_000) {
    maxBac = Math.max(
      maxBac,
      calculateDynamicBAC(
        drinks,
        weightKg,
        r,
        new Date(time),
        absorptionMinutes,
        settings.eliminationRate,
      ),
    );
  }
  return {
    startTime,
    endTime,
    maxBac: Number(maxBac.toFixed(4)),
    durationHours: Number(
      ((Math.max(...times) - Math.min(...times)) / 3_600_000).toFixed(2),
    ),
    totalAlcoholGrams: Number(
      drinks
        .reduce(
          (sum, drink) =>
            sum + calculateAlcoholGrams(drink.volumeMl, drink.abv) * drink.quantity,
          0,
        )
        .toFixed(2),
    ),
  };
}

export function calculateBACRange(
  drinks: Drink[],
  weightKg: number,
  r: number,
  targetTime: Date,
  settings = DEFAULT_SESSION_SETTINGS,
) {
  const nominalAbsorption = getAbsorptionMinutes(settings.foodLevel);
  const low = calculateDynamicBAC(
    drinks,
    weightKg,
    Math.min(1.2, r * 1.1),
    targetTime,
    Math.round(nominalAbsorption * 1.25),
    Math.min(0.03, settings.eliminationRate + 0.005),
  );
  const estimate = calculateDynamicBAC(
    drinks,
    weightKg,
    r,
    targetTime,
    nominalAbsorption,
    settings.eliminationRate,
  );
  const high = calculateDynamicBAC(
    drinks,
    weightKg,
    Math.max(0.2, r * 0.9),
    targetTime,
    Math.max(15, Math.round(nominalAbsorption * 0.75)),
    Math.max(0.005, settings.eliminationRate - 0.005),
  );
  return {
    low: Math.min(low, estimate, high),
    estimate,
    high: Math.max(low, estimate, high),
  };
}
