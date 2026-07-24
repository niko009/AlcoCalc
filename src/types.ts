export type DrinkType = 'Beer' | 'Wine' | 'Vodka' | 'Whiskey' | 'Cocktail' | 'Cognac' | 'Champagne' | 'Custom';

export interface Drink {
  id: string;
  type: DrinkType;
  volumeMl: number; // Volume of a single item
  abv: number; // Alcohol by volume (percentage, e.g. 5 for 5%)
  quantity: number; // Number of items consumed
  time: string; // ISO string representing when the drink was consumed
}

export interface UserProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  r: number; // Widmark factor
}

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD format or similar
  startTime: string; // ISO string of first drink
  endTime: string; // ISO string of last drink
  maxBac: number;
  durationHours: number;
  totalAlcoholGrams: number;
  drinks: Drink[];
  isCompleted: boolean;
}

export type IntoxicationKey = 'Sober' | 'Light' | 'Buzzed' | 'Drunk' | 'Very drunk' | 'Danger';

export interface IntoxicationLevel {
  key: IntoxicationKey;
  labelEn: string;
  labelRu: string;
  minBac: number;
  maxBac: number;
  color: string; // Tailwind hex or class name
  descriptionRu: string;
  effectsRu: string;
}
