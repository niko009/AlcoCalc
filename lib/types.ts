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
  activeSessionId: string | null;
  currentDrinks: Drink[];
  history: DrinkingSession[];
}
