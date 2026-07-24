import type {
  Drink,
  DrinkPreset,
  DrinkType,
  SessionSettings,
  UserProfile,
} from "./types";

export const MAX_FUTURE_DRINK_MINUTES = 5;

export type DrinkInput = {
  volumeMl: string;
  abv: string;
  quantity: string;
  time: string;
};

export type DrinkInputErrors = Partial<Record<keyof DrinkInput, string>>;
export type ProfileInputErrors = Partial<
  Record<"weightKg" | "heightCm" | "age" | "r", string>
>;

const DRINK_TYPES = new Set<DrinkType>([
  "Beer",
  "Wine",
  "Vodka",
  "Whiskey",
  "Cocktail",
  "Cognac",
  "Champagne",
  "Custom",
]);

export function isFiniteInRange(value: unknown, min: number, max: number) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

function validateNumberText(
  value: string,
  min: number,
  max: number,
  label: string,
) {
  if (value.trim() === "") return `${label}: заполните поле.`;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return `${label}: введите число.`;
  if (parsed < min || parsed > max) {
    return `${label}: допустимо от ${min} до ${max}.`;
  }
  return "";
}

export function validateDrinkInput(
  input: DrinkInput,
  now = new Date(),
): DrinkInputErrors {
  const errors: DrinkInputErrors = {};
  const volumeError = validateNumberText(input.volumeMl, 1, 5000, "Объём");
  const abvError = validateNumberText(input.abv, 0.1, 96, "Крепость");
  const quantityError = validateNumberText(input.quantity, 1, 100, "Количество");
  if (volumeError) errors.volumeMl = volumeError;
  if (abvError) errors.abv = abvError;
  if (quantityError) {
    errors.quantity = quantityError;
  } else if (!Number.isInteger(Number(input.quantity))) {
    errors.quantity = "Количество должно быть целым числом.";
  }

  if (!input.time) {
    errors.time = "Укажите время употребления.";
  } else {
    const timestamp = new Date(input.time).getTime();
    if (!Number.isFinite(timestamp)) {
      errors.time = "Укажите корректные дату и время.";
    } else if (
      timestamp >
      now.getTime() + MAX_FUTURE_DRINK_MINUTES * 60_000
    ) {
      errors.time = "Время не может быть больше чем на 5 минут в будущем.";
    }
  }
  return errors;
}

export function validateProfileInput(input: {
  weightKg: string;
  heightCm: string;
  age: string;
  r: string;
}): ProfileInputErrors {
  const errors: ProfileInputErrors = {};
  const weightError = validateNumberText(input.weightKg, 20, 300, "Вес");
  const heightError = validateNumberText(input.heightCm, 50, 250, "Рост");
  const ageError = validateNumberText(input.age, 18, 120, "Возраст");
  const rError = validateNumberText(input.r, 0.2, 1.2, "Коэффициент Видмарка");
  if (weightError) errors.weightKg = weightError;
  if (heightError) errors.heightCm = heightError;
  if (ageError) {
    errors.age = ageError;
  } else if (!Number.isInteger(Number(input.age))) {
    errors.age = "Возраст должен быть целым числом.";
  }
  if (rError) errors.r = rError;
  return errors;
}

export function isValidDrink(drink: unknown): drink is Drink {
  if (!drink || typeof drink !== "object") return false;
  const candidate = drink as Partial<Drink>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    candidate.id.length <= 100 &&
    typeof candidate.type === "string" &&
    DRINK_TYPES.has(candidate.type as DrinkType) &&
    typeof candidate.time === "string" &&
    Number.isFinite(Date.parse(candidate.time)) &&
    isFiniteInRange(candidate.volumeMl, 1, 5000) &&
    isFiniteInRange(candidate.abv, 0.1, 96) &&
    isFiniteInRange(candidate.quantity, 1, 100) &&
    Number.isInteger(candidate.quantity)
  );
}

export function isValidProfile(profile: unknown): profile is UserProfile {
  if (!profile || typeof profile !== "object") return false;
  const candidate = profile as Partial<UserProfile>;
  return (
    isFiniteInRange(candidate.weightKg, 20, 300) &&
    isFiniteInRange(candidate.heightCm, 50, 250) &&
    isFiniteInRange(candidate.age, 18, 120) &&
    Number.isInteger(candidate.age) &&
    isFiniteInRange(candidate.r, 0.2, 1.2) &&
    ["Male", "Female", "Other"].includes(candidate.gender ?? "")
  );
}

export function isValidSessionSettings(
  settings: unknown,
): settings is SessionSettings {
  if (!settings || typeof settings !== "object") return false;
  const candidate = settings as Partial<SessionSettings>;
  return (
    ["empty", "light", "full"].includes(candidate.foodLevel ?? "") &&
    isFiniteInRange(candidate.eliminationRate, 0.01, 0.02)
  );
}

export function isValidDrinkPreset(preset: unknown): preset is DrinkPreset {
  if (!preset || typeof preset !== "object") return false;
  const candidate = preset as Partial<DrinkPreset>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    candidate.id.length <= 100 &&
    typeof candidate.label === "string" &&
    candidate.label.trim().length > 0 &&
    candidate.label.length <= 50 &&
    typeof candidate.type === "string" &&
    DRINK_TYPES.has(candidate.type as DrinkType) &&
    isFiniteInRange(candidate.volumeMl, 1, 5000) &&
    isFiniteInRange(candidate.abv, 0.1, 96)
  );
}
