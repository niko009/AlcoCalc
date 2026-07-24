import type { AppStatePayload, Drink, DrinkPreset, DrinkingSession } from "./types";

const DEFAULT_SESSION_SETTINGS = {
  foodLevel: "light" as const,
  eliminationRate: 0.015,
};

export const LOCAL_STATE_KEY = "alcocalc.local-state.v2";
const SYNC_KEY_PREFIX = "alcocalc.last-cloud-sync.";

export type StoredLocalState = {
  state: AppStatePayload;
  updatedAt: string;
};

export function hasMeaningfulData(state: AppStatePayload) {
  return (
    state.currentDrinks.length > 0 ||
    state.history.length > 0 ||
    (state.customPresets?.length ?? 0) > 0 ||
    state.profile.weightKg !== 75 ||
    state.profile.heightCm !== 175 ||
    state.profile.age !== 28 ||
    state.profile.gender !== "Male" ||
    state.profile.r !== 0.68
  );
}

export function shouldOfferCloudMigration(
  local: StoredLocalState,
  lastCloudSync: string,
) {
  if (!hasMeaningfulData(local.state)) return false;
  if (!lastCloudSync) return true;
  return Date.parse(local.updatedAt) > Date.parse(lastCloudSync) + 1000;
}

function drinkFingerprint(drink: Drink) {
  return [
    drink.type,
    drink.volumeMl,
    drink.abv,
    drink.quantity,
    new Date(drink.time).toISOString(),
  ].join("|");
}

function mergeDrinks(primary: Drink[], secondary: Drink[]) {
  const byId = new Map<string, Drink>();
  const fingerprints = new Set<string>();
  for (const drink of [...primary, ...secondary]) {
    const fingerprint = drinkFingerprint(drink);
    if (byId.has(drink.id) || fingerprints.has(fingerprint)) continue;
    byId.set(drink.id, drink);
    fingerprints.add(fingerprint);
  }
  return [...byId.values()].sort(
    (a, b) => Date.parse(a.time) - Date.parse(b.time),
  );
}

function sessionFingerprint(session: DrinkingSession) {
  return [
    new Date(session.startTime).toISOString(),
    ...session.drinks.map(drinkFingerprint).sort(),
  ].join("::");
}

export function mergeAppStates(
  local: AppStatePayload,
  cloud: AppStatePayload,
): AppStatePayload {
  const historyById = new Map<string, DrinkingSession>();
  const historyFingerprints = new Set<string>();
  for (const session of [...local.history, ...cloud.history]) {
    const fingerprint = sessionFingerprint(session);
    if (historyById.has(session.id) || historyFingerprints.has(fingerprint)) continue;
    historyById.set(session.id, session);
    historyFingerprints.add(fingerprint);
  }

  const currentDrinks = mergeDrinks(local.currentDrinks, cloud.currentDrinks);
  const presetsById = new Map<string, DrinkPreset>();
  for (const preset of [
    ...(local.customPresets ?? []),
    ...(cloud.customPresets ?? []),
  ]) {
    const duplicate = [...presetsById.values()].some(
      (item) =>
        item.label.trim().toLowerCase() === preset.label.trim().toLowerCase() &&
        item.volumeMl === preset.volumeMl &&
        item.abv === preset.abv,
    );
    if (!presetsById.has(preset.id) && !duplicate) presetsById.set(preset.id, preset);
  }
  return {
    profile: hasMeaningfulData(local) ? local.profile : cloud.profile,
    sessionSettings: hasMeaningfulData(local)
      ? local.sessionSettings ?? DEFAULT_SESSION_SETTINGS
      : cloud.sessionSettings ?? DEFAULT_SESSION_SETTINGS,
    customPresets: [...presetsById.values()],
    activeSessionId:
      currentDrinks.length > 0
        ? local.activeSessionId ?? cloud.activeSessionId ?? cryptoSafeId()
        : null,
    currentDrinks,
    history: [...historyById.values()].sort(
      (a, b) => Date.parse(b.startTime) - Date.parse(a.startTime),
    ),
  };
}

export function loadLocalState(fallback: AppStatePayload): StoredLocalState {
  if (typeof window === "undefined") {
    return { state: fallback, updatedAt: new Date(0).toISOString() };
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_STATE_KEY);
    if (!raw) return { state: fallback, updatedAt: new Date(0).toISOString() };
    const parsed = JSON.parse(raw) as StoredLocalState;
    if (!parsed?.state?.profile || !Array.isArray(parsed.state.history)) {
      return { state: fallback, updatedAt: new Date(0).toISOString() };
    }
    return {
      ...parsed,
      state: {
        ...fallback,
        ...parsed.state,
        sessionSettings: {
          ...DEFAULT_SESSION_SETTINGS,
          ...parsed.state.sessionSettings,
        },
        customPresets: Array.isArray(parsed.state.customPresets)
          ? parsed.state.customPresets
          : [],
      },
    };
  } catch {
    return { state: fallback, updatedAt: new Date(0).toISOString() };
  }
}

export function saveLocalState(state: AppStatePayload): StoredLocalState {
  const stored = { state, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(stored));
  return stored;
}

export function getLastCloudSync(email: string) {
  return window.localStorage.getItem(`${SYNC_KEY_PREFIX}${email}`) ?? "";
}

export function setLastCloudSync(email: string, timestamp: string) {
  window.localStorage.setItem(`${SYNC_KEY_PREFIX}${email}`, timestamp);
}

function cryptoSafeId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
