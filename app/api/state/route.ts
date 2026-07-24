import { getChatGPTUser } from "../../chatgpt-auth";
import { getD1 } from "../../../db";
import type {
  AppStatePayload,
  Drink,
  DrinkPreset,
  DrinkingSession,
  UserProfile,
} from "../../../lib/types";
import {
  isFiniteInRange,
  isValidDrink,
  isValidDrinkPreset,
  isValidProfile,
  isValidSessionSettings,
} from "../../../lib/validation";

export const dynamic = "force-dynamic";

const DEFAULT_PROFILE: UserProfile = {
  weightKg: 75,
  heightCm: 175,
  age: 28,
  gender: "Male",
  r: 0.68,
};
const DEFAULT_SESSION_SETTINGS = {
  foodLevel: "light" as const,
  eliminationRate: 0.015,
};

type SessionRow = {
  id: string;
  status: "active" | "completed";
  start_time: string;
  end_time: string | null;
  max_bac: number;
  duration_hours: number;
  total_alcohol_grams: number;
};

type DrinkRow = {
  id: string;
  session_id: string;
  type: Drink["type"];
  volume_ml: number;
  abv: number;
  quantity: number;
  consumed_at: string;
};

type PresetRow = {
  id: string;
  label: string;
  type: DrinkPreset["type"];
  volume_ml: number;
  abv: number;
};

function unauthorized() {
  return Response.json({ error: "Sign in with ChatGPT is required." }, { status: 401 });
}

function asDrink(row: DrinkRow): Drink {
  return {
    id: row.id,
    type: row.type,
    volumeMl: row.volume_ml,
    abv: row.abv,
    quantity: row.quantity,
    time: row.consumed_at,
  };
}

function validateState(payload: unknown): payload is AppStatePayload {
  if (!payload || typeof payload !== "object") return false;
  const state = payload as Partial<AppStatePayload>;
  if (!isValidProfile(state.profile)) return false;
  if (!isValidSessionSettings(state.sessionSettings)) return false;
  if (
    !Array.isArray(state.customPresets) ||
    state.customPresets.length > 50 ||
    !state.customPresets.every(isValidDrinkPreset)
  ) return false;
  if (
    state.activeSessionId !== null &&
    (typeof state.activeSessionId !== "string" ||
      state.activeSessionId.length === 0 ||
      state.activeSessionId.length > 100)
  ) return false;
  if (!Array.isArray(state.currentDrinks) || state.currentDrinks.length > 500) return false;
  if (!Array.isArray(state.history) || state.history.length > 1000) return false;
  if (
    !state.history.every(
      (session) =>
        session &&
        typeof session.id === "string" &&
        session.id.length > 0 &&
        session.id.length <= 100 &&
        typeof session.startTime === "string" &&
        Number.isFinite(Date.parse(session.startTime)) &&
        typeof session.endTime === "string" &&
        Number.isFinite(Date.parse(session.endTime)) &&
        Date.parse(session.endTime) >= Date.parse(session.startTime) &&
        isFiniteInRange(session.maxBac, 0, 10) &&
        isFiniteInRange(session.durationHours, 0, 24 * 31) &&
        isFiniteInRange(session.totalAlcoholGrams, 0, 1_000_000) &&
        session.isCompleted === true &&
        Array.isArray(session.drinks) &&
        session.drinks.length <= 500,
    )
  ) return false;
  const drinks = [
    ...state.currentDrinks,
    ...state.history.flatMap((session) => session.drinks ?? []),
  ];
  return drinks.every(isValidDrink);
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return unauthorized();

  const d1 = getD1();
  await d1
    .prepare(
      `INSERT INTO users (email, display_name, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(email) DO UPDATE SET
         display_name = excluded.display_name,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(user.email, user.displayName)
    .run();

  const profileRow = await d1
    .prepare(
      `SELECT weight_kg, height_cm, age, gender, widmark_factor,
              food_level, elimination_rate
       FROM profiles WHERE user_email = ?`,
    )
    .bind(user.email)
    .first<{
      weight_kg: number;
      height_cm: number;
      age: number;
      gender: UserProfile["gender"];
      widmark_factor: number;
      food_level: AppStatePayload["sessionSettings"]["foodLevel"];
      elimination_rate: number;
    }>();

  const sessionResult = await d1
    .prepare(
      `SELECT id, status, start_time, end_time, max_bac,
              duration_hours, total_alcohol_grams
       FROM drinking_sessions
       WHERE user_email = ?
       ORDER BY start_time DESC`,
    )
    .bind(user.email)
    .all<SessionRow>();

  const drinkResult = await d1
    .prepare(
      `SELECT id, session_id, type, volume_ml, abv, quantity, consumed_at
       FROM drinks
       WHERE user_email = ?
       ORDER BY consumed_at ASC`,
    )
    .bind(user.email)
    .all<DrinkRow>();

  const presetResult = await d1
    .prepare(
      `SELECT id, label, type, volume_ml, abv
       FROM drink_presets
       WHERE user_email = ?
       ORDER BY created_at ASC`,
    )
    .bind(user.email)
    .all<PresetRow>();

  const drinksBySession = new Map<string, Drink[]>();
  for (const row of drinkResult.results) {
    const list = drinksBySession.get(row.session_id) ?? [];
    list.push(asDrink(row));
    drinksBySession.set(row.session_id, list);
  }

  const active = sessionResult.results.find((session) => session.status === "active");
  const history: DrinkingSession[] = sessionResult.results
    .filter((session) => session.status === "completed")
    .map((session) => ({
      id: session.id,
      startTime: session.start_time,
      endTime: session.end_time ?? session.start_time,
      maxBac: session.max_bac,
      durationHours: session.duration_hours,
      totalAlcoholGrams: session.total_alcohol_grams,
      drinks: drinksBySession.get(session.id) ?? [],
      isCompleted: true,
    }));

  const state: AppStatePayload = {
    profile: profileRow
      ? {
          weightKg: profileRow.weight_kg,
          heightCm: profileRow.height_cm,
          age: profileRow.age,
          gender: profileRow.gender,
          r: profileRow.widmark_factor,
        }
      : DEFAULT_PROFILE,
    sessionSettings: profileRow
      ? {
          foodLevel: profileRow.food_level,
          eliminationRate: profileRow.elimination_rate,
        }
      : DEFAULT_SESSION_SETTINGS,
    customPresets: presetResult.results.map((row) => ({
      id: row.id,
      label: row.label,
      type: row.type,
      volumeMl: row.volume_ml,
      abv: row.abv,
    })),
    activeSessionId: active?.id ?? null,
    currentDrinks: active ? drinksBySession.get(active.id) ?? [] : [],
    history,
  };

  return Response.json({ state, user });
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return unauthorized();

  const payload: unknown = await request.json().catch(() => null);
  if (!validateState(payload)) {
    return Response.json({ error: "Invalid AlcoCalc state." }, { status: 400 });
  }

  const d1 = getD1();
  const statements = [
    d1
      .prepare(
        `INSERT INTO users (email, display_name, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(email) DO UPDATE SET
           display_name = excluded.display_name,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(user.email, user.displayName),
    d1
      .prepare(
        `INSERT INTO profiles
          (user_email, weight_kg, height_cm, age, gender, widmark_factor,
           food_level, elimination_rate, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_email) DO UPDATE SET
           weight_kg = excluded.weight_kg,
           height_cm = excluded.height_cm,
           age = excluded.age,
           gender = excluded.gender,
           widmark_factor = excluded.widmark_factor,
           food_level = excluded.food_level,
           elimination_rate = excluded.elimination_rate,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(
        user.email,
        payload.profile.weightKg,
        payload.profile.heightCm,
        payload.profile.age,
        payload.profile.gender,
        payload.profile.r,
        payload.sessionSettings.foodLevel,
        payload.sessionSettings.eliminationRate,
      ),
    d1.prepare("DELETE FROM drink_presets WHERE user_email = ?").bind(user.email),
    d1
      .prepare(
        `DELETE FROM drinks
         WHERE session_id IN (
           SELECT id FROM drinking_sessions WHERE user_email = ?
         )`,
      )
      .bind(user.email),
    d1.prepare("DELETE FROM drinking_sessions WHERE user_email = ?").bind(user.email),
  ];

  for (const preset of payload.customPresets) {
    statements.push(
      d1
        .prepare(
          `INSERT INTO drink_presets
            (id, user_email, label, type, volume_ml, abv)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          preset.id,
          user.email,
          preset.label,
          preset.type,
          preset.volumeMl,
          preset.abv,
        ),
    );
  }

  const sessions: Array<{
    session: DrinkingSession;
    status: "active" | "completed";
  }> = payload.history.map((session) => ({ session, status: "completed" }));

  if (payload.currentDrinks.length > 0) {
    const times = payload.currentDrinks.map((drink) => Date.parse(drink.time));
    sessions.push({
      status: "active",
      session: {
        id: payload.activeSessionId ?? crypto.randomUUID(),
        startTime: new Date(Math.min(...times)).toISOString(),
        endTime: new Date(Math.max(...times)).toISOString(),
        maxBac: 0,
        durationHours: 0,
        totalAlcoholGrams: 0,
        drinks: payload.currentDrinks,
        isCompleted: false,
      },
    });
  }

  for (const { session, status } of sessions) {
    statements.push(
      d1
        .prepare(
          `INSERT INTO drinking_sessions
            (id, user_email, status, start_time, end_time, max_bac,
             duration_hours, total_alcohol_grams, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        )
        .bind(
          session.id,
          user.email,
          status,
          session.startTime,
          session.endTime,
          session.maxBac,
          session.durationHours,
          session.totalAlcoholGrams,
        ),
    );
    for (const drink of session.drinks) {
      statements.push(
        d1
          .prepare(
            `INSERT INTO drinks
              (id, session_id, user_email, type, volume_ml, abv, quantity, consumed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            drink.id,
            session.id,
            user.email,
            drink.type,
            drink.volumeMl,
            drink.abv,
            drink.quantity,
            drink.time,
          ),
      );
    }
  }

  await d1.batch(statements);
  return Response.json({ ok: true });
}
