import { Drink, IntoxicationLevel, IntoxicationKey } from '../types';

/**
 * Calculates the mass of pure alcohol in grams.
 * Formula: alcoholGrams = volumeMl × (abv / 100) × 0.789
 */
export function calculateAlcoholGrams(volumeMl: number, abv: number): number {
  if (volumeMl <= 0 || abv <= 0) return 0;
  return volumeMl * (abv / 100) * 0.789;
}

/**
 * Calculates Blood Alcohol Content (BAC) in % using the Widmark formula.
 * Formula: bac = (totalAlcoholGrams / (weightKg × r × 1000)) × 100 − 0.015 × hoursSinceFirstDrink
 */
export function calculateBAC(
  totalAlcoholGrams: number,
  weightKg: number,
  r: number,
  hoursSinceFirstDrink: number
): number {
  if (totalAlcoholGrams <= 0 || weightKg <= 0 || r <= 0) return 0;
  
  const rawBac = (totalAlcoholGrams / (weightKg * r * 1000)) * 100;
  const currentBac = rawBac - 0.015 * Math.max(0, hoursSinceFirstDrink);
  
  return currentBac < 0 ? 0 : currentBac;
}

/**
 * Converts BAC percentage to Permille (‰).
 * Formula: permille = bac × 10
 */
export function calculatePermille(bac: number): number {
  return Math.max(0, bac * 10);
}

/**
 * Calculates the approximate time (in hours) to fully eliminate the alcohol.
 * Formula: hoursToZero = bac / 0.015
 */
export function calculateHoursToZero(bac: number): number {
  if (bac <= 0) return 0;
  return bac / 0.015;
}

export const INTOXICATION_LEVELS: IntoxicationLevel[] = [
  {
    key: 'Sober',
    labelEn: 'Sober',
    labelRu: 'Трезвый',
    minBac: 0.00,
    maxBac: 0.02,
    color: '#10B981', // green-500
    descriptionRu: 'Никаких видимых признаков влияния алкоголя. Концентрация в норме.',
    effectsRu: 'Нормальное поведение, отсутствие нарушений.'
  },
  {
    key: 'Light',
    labelEn: 'Light',
    labelRu: 'Легкое опьянение',
    minBac: 0.02,
    maxBac: 0.05,
    color: '#84CC16', // lime-500
    descriptionRu: 'Мягкое расслабление, легкая приподнятость настроения и тепло.',
    effectsRu: 'Слегка снижается координация, общительность возрастает.'
  },
  {
    key: 'Buzzed',
    labelEn: 'Buzzed',
    labelRu: 'Заметное опьянение',
    minBac: 0.05,
    maxBac: 0.08,
    color: '#F59E0B', // amber-500
    descriptionRu: 'Разговорчивость, сильное расслабление мышц, избыточная уверенность.',
    effectsRu: 'Снижение быстроты реакции, ухудшение оценки ситуации.'
  },
  {
    key: 'Drunk',
    labelEn: 'Drunk',
    labelRu: 'Сильное опьянение',
    minBac: 0.08,
    maxBac: 0.15,
    color: '#F97316', // orange-500
    descriptionRu: 'Заметные нарушения координации движений, смазанная речь, замедление реакций.',
    effectsRu: 'Ухудшение слуха и зрения. Вождение транспорта категорически запрещено!'
  },
  {
    key: 'Very drunk',
    labelEn: 'Very drunk',
    labelRu: 'Тяжелое опьянение',
    minBac: 0.15,
    maxBac: 0.25,
    color: '#EF4444', // red-500
    descriptionRu: 'Сильная дезориентация, двоение в глазах, потеря равновесия, эмоциональная нестабильность.',
    effectsRu: 'Высокий риск интоксикации, частичная амнезия, угнетение рефлексов.'
  },
  {
    key: 'Danger',
    labelEn: 'Danger',
    labelRu: 'Опасная доза',
    minBac: 0.25,
    maxBac: 999.0,
    color: '#7F1D1D', // red-900
    descriptionRu: 'Критическое состояние, риск потери сознания, алкогольной комы.',
    effectsRu: 'Угроза жизни, паралич дыхательного центра. Срочно вызовите скорую помощь!'
  }
];

/**
 * Returns the intoxication level detail based on BAC.
 */
export function getIntoxicationLevel(bac: number): IntoxicationLevel {
  const level = INTOXICATION_LEVELS.find(l => bac >= l.minBac && bac < l.maxBac);
  return level || INTOXICATION_LEVELS[INTOXICATION_LEVELS.length - 1];
}

/**
 * Calculates dynamic BAC at any given time T by adding the remaining alcohol
 * from each drink individually. Each drink is absorbed instantly at its consumption
 * time, then decays at a rate of 0.015 BAC/hour. This matches realistic timeline behavior.
 */
export function calculateDynamicBAC(
  drinks: Drink[],
  weightKg: number,
  r: number,
  targetTime: Date
): number {
  if (drinks.length === 0 || weightKg <= 0 || r <= 0) return 0;
  
  let totalBac = 0;
  const targetMs = targetTime.getTime();

  for (const drink of drinks) {
    const drinkMs = new Date(drink.time).getTime();
    if (targetMs < drinkMs) continue; // Drink not yet consumed at targetTime

    const hours = (targetMs - drinkMs) / (1000 * 60 * 60);
    const grams = calculateAlcoholGrams(drink.volumeMl, drink.abv) * drink.quantity;
    const drinkPeakBac = (grams / (weightKg * r * 1000)) * 100;
    
    const drinkCurrentBac = drinkPeakBac - 0.015 * hours;
    if (drinkCurrentBac > 0) {
      totalBac += drinkCurrentBac;
    }
  }

  return totalBac;
}

/**
 * Generates data points for plotting BAC over time (e.g., from first drink to complete sobriety).
 */
export interface TimelinePoint {
  timeLabel: string;
  timeRaw: Date;
  bac: number;
  permille: number;
}

export function generateBACTimeline(
  drinks: Drink[],
  weightKg: number,
  r: number,
  intervalMinutes: number = 15
): TimelinePoint[] {
  if (drinks.length === 0) return [];

  // Find first drink time
  const times = drinks.map(d => new Date(d.time).getTime());
  const firstTime = new Date(Math.min(...times));
  
  // Calculate when it decays to zero by running a simulation from firstTime
  // We can simulate forward hour-by-hour/interval-by-interval until BAC reaches zero.
  // To avoid infinite loops, let's set a safe limit of 24 hours from the last drink.
  const lastTime = new Date(Math.max(...times));
  const maxSimulateTime = new Date(lastTime.getTime() + 24 * 60 * 60 * 1000);

  const points: TimelinePoint[] = [];
  let currentTime = new Date(firstTime.getTime());

  // Let's align first time to a nice boundary if possible, or just start from firstTime
  // We'll increment currentTime by intervalMinutes until BAC becomes 0 and is after lastTime.
  let safetyCounter = 0;
  const maxPoints = 200; // Limit points for charting performance

  while (currentTime <= maxSimulateTime && safetyCounter < maxPoints) {
    const bac = calculateDynamicBAC(drinks, weightKg, r, currentTime);
    const permille = calculatePermille(bac);
    
    points.push({
      timeLabel: currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timeRaw: new Date(currentTime.getTime()),
      bac: parseFloat(bac.toFixed(4)),
      permille: parseFloat(permille.toFixed(3))
    });

    // If BAC is zero and we have passed the last drink, we can stop
    if (bac === 0 && currentTime > lastTime) {
      break;
    }

    currentTime = new Date(currentTime.getTime() + intervalMinutes * 60 * 1000);
    safetyCounter++;
  }

  return points;
}
