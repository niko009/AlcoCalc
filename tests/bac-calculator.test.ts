import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ABSORPTION_MINUTES,
  calculateAlcoholGrams,
  calculateDynamicBAC,
  calculateForecast,
  calculateSobrietyTime,
} from "../lib/bac-calculator.ts";
import type { Drink } from "../lib/types.ts";
import {
  mergeAppStates,
  shouldOfferCloudMigration,
} from "../lib/local-state.ts";
import {
  isValidDrink,
  isValidProfile,
  validateDrinkInput,
  validateProfileInput,
} from "../lib/validation.ts";

const baseTime = new Date("2026-07-24T12:00:00Z");
const vodka: Drink = {
  id: "vodka-1",
  type: "Vodka",
  volumeMl: 50,
  abv: 40,
  quantity: 1,
  time: baseTime.toISOString(),
};

test("pure alcohol mass uses ethanol density", () => {
  assert.ok(Math.abs(calculateAlcoholGrams(500, 5) - 19.725) < 0.001);
  assert.ok(Math.abs(calculateAlcoholGrams(50, 40) - 15.78) < 0.001);
});

test("a drink is absorbed over time instead of appearing instantly", () => {
  assert.equal(calculateDynamicBAC([vodka], 80, 0.68, baseTime), 0);
  const absorptionEnd = new Date(
    baseTime.getTime() + DEFAULT_ABSORPTION_MINUTES * 60_000,
  );
  assert.ok(calculateDynamicBAC([vodka], 80, 0.68, absorptionEnd) > 0);
});

test("elimination is applied once to total BAC, not once per drink", () => {
  const drinks = [vodka, { ...vodka, id: "vodka-2" }, { ...vodka, id: "vodka-3" }];
  const oneHour = new Date(baseTime.getTime() + 3_600_000);
  const oneDrinkPeak = (15.78 / (80 * 0.68 * 1000)) * 100;
  const expected = oneDrinkPeak * 3 - 0.015;
  assert.ok(
    Math.abs(calculateDynamicBAC(drinks, 80, 0.68, oneHour) - expected) < 0.0001,
  );
});

test("a later drink is not penalized by an earlier sober interval", () => {
  const later = {
    ...vodka,
    id: "later",
    time: new Date(baseTime.getTime() + 4 * 3_600_000).toISOString(),
  };
  const laterEnd = new Date(
    Date.parse(later.time) + DEFAULT_ABSORPTION_MINUTES * 60_000,
  );
  const firstOnly = calculateDynamicBAC([vodka], 80, 0.68, laterEnd);
  const combined = calculateDynamicBAC([vodka, later], 80, 0.68, laterEnd);
  assert.equal(firstOnly, 0);
  assert.ok(combined > 0);
});

test("estimated sobriety time resolves to zero BAC", () => {
  const soberAt = calculateSobrietyTime([vodka], 80, 0.68, baseTime);
  assert.equal(calculateDynamicBAC([vodka], 80, 0.68, soberAt), 0);
});

test("forecast returns a peak and near-zero after the peak", () => {
  const forecast = calculateForecast([vodka], 80, 0.68, baseTime);
  assert.ok(forecast.peakBac > 0);
  assert.ok(forecast.peakTime > baseTime);
  assert.ok(forecast.nearZeroTime > forecast.peakTime);
});

test("local-to-cloud merge keeps data and removes duplicate drinks and sessions", () => {
  const session = {
    id: "session-1",
    startTime: vodka.time,
    endTime: vodka.time,
    maxBac: 0.02,
    durationHours: 0,
    totalAlcoholGrams: 15.78,
    drinks: [vodka],
    isCompleted: true,
  };
  const profile = {
    weightKg: 80,
    heightCm: 180,
    age: 35,
    gender: "Male" as const,
    r: 0.68,
  };
  const merged = mergeAppStates(
    {
      profile,
      activeSessionId: "active-local",
      currentDrinks: [vodka],
      history: [session],
    },
    {
      profile: { ...profile, weightKg: 70 },
      activeSessionId: "active-cloud",
      currentDrinks: [{ ...vodka, id: "same-drink-different-id" }],
      history: [{ ...session, id: "same-session-different-id" }],
    },
  );
  assert.equal(merged.profile.weightKg, 80);
  assert.equal(merged.currentDrinks.length, 1);
  assert.equal(merged.history.length, 1);
});

test("migration is offered on first sign-in and after anonymous changes only", () => {
  const meaningfulState = {
    profile: {
      weightKg: 80,
      heightCm: 180,
      age: 35,
      gender: "Male" as const,
      r: 0.68,
    },
    activeSessionId: null,
    currentDrinks: [],
    history: [],
  };
  assert.equal(
    shouldOfferCloudMigration(
      { state: meaningfulState, updatedAt: "2026-07-24T10:00:00Z" },
      "",
    ),
    true,
  );
  assert.equal(
    shouldOfferCloudMigration(
      { state: meaningfulState, updatedAt: "2026-07-24T10:00:00Z" },
      "2026-07-24T10:00:00Z",
    ),
    false,
  );
  assert.equal(
    shouldOfferCloudMigration(
      { state: meaningfulState, updatedAt: "2026-07-24T10:05:00Z" },
      "2026-07-24T10:00:00Z",
    ),
    true,
  );
});

test("drink form rejects empty, fractional quantity and future time", () => {
  const now = new Date("2026-07-24T12:00:00Z");
  const empty = validateDrinkInput(
    { volumeMl: "", abv: "", quantity: "", time: "" },
    now,
  );
  assert.ok(empty.volumeMl);
  assert.ok(empty.abv);
  assert.ok(empty.quantity);
  assert.ok(empty.time);

  const invalid = validateDrinkInput(
    {
      volumeMl: "500",
      abv: "5",
      quantity: "1.5",
      time: "2026-07-24T12:06",
    },
    now,
  );
  assert.equal(invalid.quantity, "Количество должно быть целым числом.");
  assert.ok(invalid.time);
});

test("profile form validates ranges and integer age", () => {
  const invalid = validateProfileInput({
    weightKg: "19",
    heightCm: "251",
    age: "30.5",
    r: "1.3",
  });
  assert.ok(invalid.weightKg);
  assert.ok(invalid.heightCm);
  assert.equal(invalid.age, "Возраст должен быть целым числом.");
  assert.ok(invalid.r);
});

test("stored profile and drink validators reject corrupted numeric data", () => {
  assert.equal(isValidDrink(vodka), true);
  assert.equal(isValidDrink({ ...vodka, quantity: Number.NaN }), false);
  assert.equal(isValidDrink({ ...vodka, type: "Unknown" }), false);
  assert.equal(
    isValidProfile({
      weightKg: 80,
      heightCm: 180,
      age: 35,
      gender: "Male",
      r: 0.68,
    }),
    true,
  );
  assert.equal(
    isValidProfile({
      weightKg: Number.POSITIVE_INFINITY,
      heightCm: 180,
      age: 35,
      gender: "Male",
      r: 0.68,
    }),
    false,
  );
});

test("BAC math ignores non-finite and invalid quantities", () => {
  assert.equal(calculateAlcoholGrams(Number.NaN, 5), 0);
  assert.equal(
    calculateDynamicBAC(
      [{ ...vodka, quantity: Number.POSITIVE_INFINITY }],
      80,
      0.68,
      new Date(baseTime.getTime() + 3_600_000),
    ),
    0,
  );
});
