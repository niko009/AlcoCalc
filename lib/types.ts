export type DrinkType =
  | "Beer"
  | "Wine"
  | "Vodka"
  | "Whiskey"
  | "Cocktail"
  | "Cognac"
  | "Champagne"
  | "Custom";

export interface Drink {
  id: string;
  type: DrinkType;
  volumeMl: number;
  abv: number;
  quantity: number;
  time: string;
}

export interface UserProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: "Male" | "Female" | "Other";
  r: number;
}

export type FoodLevel = "empty" | "light" | "full";

export interface SessionSettings {
  foodLevel: FoodLevel;
  eliminationRate: number;
}

export interface DrinkPreset {
  id: string;
  label: string;
  type: DrinkType;
  volumeMl: number;
  abv: number;
}

export interface DrinkingSession {
  id: string;
  startTime: string;
  endTime: string;
  maxBac: number;
  durationHours: number;
  totalAlcoholGrams: number;
  drinks: Drink[];
  isCompleted: boolean;
}

export interface AppStatePayload {
  profile: UserProfile;
  sessionSettings: SessionSettings;
  customPresets: DrinkPreset[];
  activeSessionId: string | null;
  currentDrinks: Drink[];
  history: DrinkingSession[];
}
