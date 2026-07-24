"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Beer,
  CalendarCheck,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronUp,
  Clock,
  Cloud,
  Download,
  GlassWater,
  History,
  Home,
  LogOut,
  Plus,
  Pencil,
  Save,
  ShieldAlert,
  Trash2,
  User,
} from "lucide-react";
import type {
  AppStatePayload,
  Drink,
  DrinkType,
  DrinkingSession,
  UserProfile,
} from "../lib/types";
import {
  calculateAlcoholGrams,
  calculateDynamicBAC,
  calculateForecast,
  calculatePermille,
  calculateSessionStats,
  generateBACTimeline,
  getIntoxicationLevel,
} from "../lib/bac-calculator";
import {
  getLastCloudSync,
  loadLocalState,
  mergeAppStates,
  saveLocalState,
  setLastCloudSync,
  shouldOfferCloudMigration,
} from "../lib/local-state";
import {
  type DrinkInputErrors,
  type ProfileInputErrors,
  validateDrinkInput,
  validateProfileInput,
} from "../lib/validation";

type Tab = "home" | "add" | "history" | "profile";
type SaveState = "idle" | "saving" | "saved" | "error";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DEFAULT_STATE: AppStatePayload = {
  profile: { weightKg: 75, heightCm: 175, age: 28, gender: "Male", r: 0.68 },
  activeSessionId: null,
  currentDrinks: [],
  history: [],
};

const PRESETS: Array<{
  type: DrinkType;
  label: string;
  volumeMl: number;
  abv: number;
}> = [
  { type: "Beer", label: "Пиво", volumeMl: 500, abv: 5 },
  { type: "Wine", label: "Вино", volumeMl: 150, abv: 12 },
  { type: "Vodka", label: "Водка", volumeMl: 50, abv: 40 },
  { type: "Whiskey", label: "Виски", volumeMl: 50, abv: 40 },
  { type: "Champagne", label: "Шампанское", volumeMl: 150, abv: 11 },
  { type: "Cognac", label: "Коньяк", volumeMl: 50, abv: 40 },
];

const nav = [
  { id: "home" as const, label: "Главная", icon: Home },
  { id: "add" as const, label: "Добавить", icon: Beer },
  { id: "history" as const, label: "История", icon: History },
  { id: "profile" as const, label: "Профиль", icon: User },
];

function localDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function createId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function AlcoApp({
  user,
  demo = false,
}: {
  user: { displayName: string; email: string } | null;
  demo?: boolean;
}) {
  const [state, setState] = useState(DEFAULT_STATE);
  const [tab, setTab] = useState<Tab>("home");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [cloudReady, setCloudReady] = useState(false);
  const [pendingCloudState, setPendingCloudState] =
    useState<AppStatePayload | null>(null);
  const [showMigration, setShowMigration] = useState(false);
  const [editingDrink, setEditingDrink] = useState<Drink | null>(null);
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [now, setNow] = useState(() => new Date());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirstPersist = useRef(true);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator && !demo) {
      void navigator.serviceWorker.register("/sw.js");
    }
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
  }, [demo]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      const local = demo
        ? { state: DEFAULT_STATE, updatedAt: new Date(0).toISOString() }
        : loadLocalState(DEFAULT_STATE);
      if (cancelled) return;
      setState(local.state);
      setLoaded(true);

      if (!user || demo) return;
      setSaveState("saving");
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) throw new Error("Не удалось загрузить облачные данные.");
      const { state: cloudState } = (await response.json()) as {
        state: AppStatePayload;
      };
      if (cancelled) return;

      const lastSync = getLastCloudSync(user.email);
      const shouldOfferMigration = shouldOfferCloudMigration(local, lastSync);

      if (shouldOfferMigration) {
        setPendingCloudState(cloudState);
        setShowMigration(true);
        setSaveState("idle");
      } else {
        setState(cloudState);
        saveLocalState(cloudState);
        setCloudReady(true);
        setSaveState("saved");
      }
    }).catch((error) => {
      if (!cancelled) {
        setLoadError(error instanceof Error ? error.message : "Ошибка загрузки");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [demo, user]);

  useEffect(() => {
    if (!loaded || demo) return;
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    const stored = saveLocalState(state);
    if (!user || !cloudReady) {
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveState("saving");
      void fetch("/api/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state),
      })
        .then((response) => {
          if (!response.ok) throw new Error("Не удалось сохранить изменения.");
          setLastCloudSync(user.email, stored.updatedAt);
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, loaded, demo, user, cloudReady]);

  const migrateToCloud = async () => {
    if (!user || !pendingCloudState) return;
    const merged = mergeAppStates(state, pendingCloudState);
    setSaveState("saving");
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(merged),
    });
    if (!response.ok) {
      setSaveState("error");
      return;
    }
    const stored = saveLocalState(merged);
    setLastCloudSync(user.email, stored.updatedAt);
    setState(merged);
    setPendingCloudState(null);
    setShowMigration(false);
    setCloudReady(true);
    setSaveState("saved");
  };

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-red-100 bg-white p-7 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-4 text-xl font-bold">Данные пока недоступны</h1>
          <p className="mt-2 text-sm text-slate-500">{loadError}</p>
          <button
            onClick={() => location.reload()}
            className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          >
            Повторить
          </button>
        </div>
      </main>
    );
  }

  if (!loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
          <p className="mt-4 text-sm text-slate-500">Загружаем ваш AlcoCalc…</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-800 sm:pb-10">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <button onClick={() => setTab("home")} className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-amber-300">
              <ChartNoAxesCombined className="h-5 w-5" />
            </span>
            <span className="text-left">
              <span className="block text-sm font-black tracking-tight">AlcoCalc</span>
              <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400">
                Widmark + absorption
              </span>
            </span>
          </button>

          <nav className="hidden rounded-xl border border-slate-200 bg-slate-100 p-1 sm:flex">
            {nav.map((item) => (
              <NavButton key={item.id} item={item} active={tab === item.id} onClick={setTab} />
            ))}
          </nav>

          <div className="flex items-center gap-2">
          {installPrompt && (
            <button
              type="button"
              onClick={() => {
                void installPrompt.prompt().then(async () => {
                  await installPrompt.userChoice;
                  setInstallPrompt(null);
                });
              }}
              className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              <Download className="h-3.5 w-3.5" />
              Установить
            </button>
          )}
          {user ? (
            <div className="flex items-center gap-2 text-right">
              <div className="hidden sm:block">
                <p className="max-w-40 truncate text-xs font-semibold">
                  {user.displayName}
                </p>
                <p className="flex items-center justify-end gap-1 text-[10px] text-slate-400">
                  <Cloud className="h-3 w-3" />
                  {saveState === "saving" && "Сохраняем…"}
                  {saveState === "saved" && "В облаке"}
                  {saveState === "idle" && "Локально"}
                  {saveState === "error" && "Ошибка сохранения"}
                </p>
              </div>
              <a
                href="/signout-with-chatgpt?return_to=%2F"
                aria-label="Выйти"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
              </a>
            </div>
          ) : (
            <a
              href="/signin-with-chatgpt?return_to=%2F"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
            >
              Войти и сохранить данные
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        {tab === "home" && (
          <Dashboard
            state={state}
            now={now}
            setState={setState}
            onAdd={() => setTab("add")}
            onHistory={() => setTab("history")}
            onEdit={(drink) => {
              setEditingDrink(drink);
              setTab("add");
            }}
          />
        )}
        {tab === "add" && (
          <AddDrink
            initialDrink={editingDrink}
            lastDrink={state.currentDrinks.at(-1)}
            onCancel={() => {
              setEditingDrink(null);
              setTab("home");
            }}
            onAdd={(drink) => {
              setState((current) => ({
                ...current,
                activeSessionId: current.activeSessionId ?? createId(),
                currentDrinks: [
                  ...current.currentDrinks.filter((item) => item.id !== drink.id),
                  drink,
                ].sort(
                  (a, b) => Date.parse(a.time) - Date.parse(b.time),
                ),
              }));
              setEditingDrink(null);
              setTab("home");
            }}
          />
        )}
        {tab === "history" && (
          <HistoryView
            history={state.history}
            onDelete={(id) =>
              setState((current) => ({
                ...current,
                history: current.history.filter((session) => session.id !== id),
              }))
            }
          />
        )}
        {tab === "profile" && (
          <ProfileView
            profile={state.profile}
            user={user}
            onSave={(profile) => setState((current) => ({ ...current, profile }))}
          />
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-100 bg-white/95 px-2 py-2 shadow-[0_-6px_24px_-12px_rgba(15,23,42,.25)] backdrop-blur sm:hidden">
        {nav.map((item) => (
          <NavButton key={item.id} item={item} active={tab === item.id} onClick={setTab} mobile />
        ))}
      </nav>

      {showMigration && user && pendingCloudState && (
        <MigrationDialog
          onMigrate={() => void migrateToCloud()}
          onLater={() => {
            setShowMigration(false);
            setPendingCloudState(null);
            setSaveState("idle");
          }}
        />
      )}
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
  mobile = false,
}: {
  item: (typeof nav)[number];
  active: boolean;
  onClick: (tab: Tab) => void;
  mobile?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onClick(item.id)}
      className={`${mobile ? "flex-col py-2 text-[10px]" : "px-3 py-2 text-xs"} flex items-center justify-center gap-1.5 rounded-lg font-semibold transition ${
        active ? "bg-white text-slate-950 shadow-sm" : "text-slate-400 hover:text-slate-700"
      }`}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </button>
  );
}

function Dashboard({
  state,
  now,
  setState,
  onAdd,
  onHistory,
  onEdit,
}: {
  state: AppStatePayload;
  now: Date;
  setState: React.Dispatch<React.SetStateAction<AppStatePayload>>;
  onAdd: () => void;
  onHistory: () => void;
  onEdit: (drink: Drink) => void;
}) {
  const { profile, currentDrinks } = state;
  const bac = calculateDynamicBAC(currentDrinks, profile.weightKg, profile.r, now);
  const permille = calculatePermille(bac);
  const level = getIntoxicationLevel(bac);
  const forecast = calculateForecast(
    currentDrinks,
    profile.weightKg,
    profile.r,
    now,
  );
  const remainingMinutes = Math.max(
    0,
    Math.ceil((forecast.nearZeroTime.getTime() - now.getTime()) / 60_000),
  );
  const bacRangeLow = bac * 0.8;
  const bacRangeHigh = bac * 1.25;
  const timeline = useMemo(
    () => generateBACTimeline(currentDrinks, profile.weightKg, profile.r),
    [currentDrinks, profile.weightKg, profile.r],
  );
  const totalGrams = currentDrinks.reduce(
    (sum, drink) =>
      sum + calculateAlcoholGrams(drink.volumeMl, drink.abv) * drink.quantity,
    0,
  );
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference - Math.min(1, bac / 0.3) * circumference;

  const complete = () => {
    if (!currentDrinks.length) return;
    const stats = calculateSessionStats(currentDrinks, profile.weightKg, profile.r);
    const session: DrinkingSession = {
      id: state.activeSessionId ?? createId(),
      ...stats,
      drinks: currentDrinks,
      isCompleted: true,
    };
    setState((current) => ({
      ...current,
      activeSessionId: null,
      currentDrinks: [],
      history: [session, ...current.history],
    }));
    onHistory();
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-6 md:grid-cols-3">
        <article className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Текущее состояние
          </p>
          <div className="relative mx-auto mt-4 h-44 w-44">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="10" />
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={level.color}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={dash}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <strong className="text-3xl font-black">{bac.toFixed(3)}</strong>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                BAC %
              </span>
              <span className="mt-2 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold">
                {permille.toFixed(2)} ‰
              </span>
            </div>
          </div>
          <span
            className="mt-4 inline-block rounded-full px-4 py-1.5 text-xs font-bold text-white"
            style={{ background: level.color }}
          >
            {level.label}
          </span>
          <p className="mt-3 text-xs leading-5 text-slate-500">{level.description}</p>
        </article>

        <article className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm md:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h1 className="text-lg font-black">Активная сессия</h1>
            {currentDrinks.length > 0 && (
              <span className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                {currentDrinks.length} записей
              </span>
            )}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric
              label="До near-zero (≤ 0.005%)"
              value={
                remainingMinutes
                  ? `${Math.floor(remainingMinutes / 60)} ч ${remainingMinutes % 60} мин`
                  : "Трезвый"
              }
              detail={remainingMinutes ? `Ориентировочно в ${forecast.nearZeroTime.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : "BAC по модели близок к нулю"}
            />
            <Metric
              label="Чистого алкоголя"
              value={`${totalGrams.toFixed(1)} г`}
              detail={`${currentDrinks.reduce((sum, drink) => sum + drink.volumeMl * drink.quantity, 0)} мл напитков`}
            />
          </div>
          {currentDrinks.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Metric
                label="Диапазон оценки BAC"
                value={`${bacRangeLow.toFixed(3)}–${bacRangeHigh.toFixed(3)}%`}
                detail="Условный диапазон ±20–25%, не измерение"
              />
              <Metric
                label="Прогноз пика"
                value={`${forecast.peakBac.toFixed(3)}%`}
                detail={`Ориентировочно в ${forecast.peakTime.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`}
              />
            </div>
          )}
          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-900">
              <ShieldAlert className="h-4 w-4" />
              Важно
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{level.effects}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={onAdd} className="action-primary">
              <Plus className="h-4 w-4" /> Добавить напиток
            </button>
            {currentDrinks.length > 0 && (
              <button onClick={complete} className="action-secondary">
                <CalendarCheck className="h-4 w-4 text-emerald-600" /> Завершить сессию
              </button>
            )}
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <ChartNoAxesCombined className="h-4 w-4 text-slate-500" />
            Прогноз BAC во времени
          </h2>
          <span className="text-[10px] text-slate-400">Шаг 15 минут</span>
        </div>
        <div className="h-64">
          {timeline.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="bac-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={level.color} stopOpacity={0.38} />
                    <stop offset="95%" stopColor={level.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={10} />
                <YAxis tickLine={false} axisLine={false} fontSize={10} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="bac"
                  stroke={level.color}
                  strokeWidth={2}
                  fill="url(#bac-fill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl bg-slate-50 text-center">
              <GlassWater className="h-9 w-9 text-slate-300" />
              <p className="mt-3 text-xs text-slate-500">
                Добавьте первый напиток — здесь появится прогноз.
              </p>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-black">Напитки текущей сессии</h2>
        {currentDrinks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-8 text-center text-sm text-slate-400">
            Активной сессии пока нет.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            {currentDrinks.map((drink) => (
              <DrinkRow
                key={drink.id}
                drink={drink}
                onEdit={() => onEdit(drink)}
                onDelete={() =>
                  setState((current) => ({
                    ...current,
                    activeSessionId:
                      current.currentDrinks.length === 1 ? null : current.activeSessionId,
                    currentDrinks: current.currentDrinks.filter((item) => item.id !== drink.id),
                  }))
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <strong className="mt-1 block text-xl font-black text-slate-800">{value}</strong>
      <span className="mt-1 block text-[11px] text-slate-500">{detail}</span>
    </div>
  );
}

function DrinkRow({
  drink,
  onDelete,
  onEdit,
}: {
  drink: Drink;
  onDelete?: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          {drink.type === "Beer" ? <Beer className="h-5 w-5" /> : <GlassWater className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{drink.type}</p>
          <p className="text-[11px] text-slate-400">
            {drink.quantity} × {drink.volumeMl} мл · {drink.abv}% ·{" "}
            {new Date(drink.time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
      <div className="flex items-center">
        {onEdit && (
          <button
            onClick={onEdit}
            aria-label="Редактировать напиток"
            className="rounded-lg p-2 text-slate-300 hover:bg-slate-100 hover:text-slate-700"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} aria-label="Удалить напиток" className="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function AddDrink({
  initialDrink,
  lastDrink,
  onAdd,
  onCancel,
}: {
  initialDrink: Drink | null;
  lastDrink?: Drink;
  onAdd: (drink: Drink) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<DrinkType>(initialDrink?.type ?? "Beer");
  const [volumeMl, setVolume] = useState(String(initialDrink?.volumeMl ?? 500));
  const [abv, setAbv] = useState(String(initialDrink?.abv ?? 5));
  const [quantity, setQuantity] = useState(String(initialDrink?.quantity ?? 1));
  const [presetRevision, setPresetRevision] = useState(0);
  const [errors, setErrors] = useState<DrinkInputErrors>({});
  const [time, setTime] = useState(
    initialDrink ? localDateTimeValue(new Date(initialDrink.time)) : localDateTimeValue(),
  );

  const choosePreset = (preset: (typeof PRESETS)[number]) => {
    setType(preset.type);
    setVolume(String(preset.volumeMl));
    setAbv(String(preset.abv));
    setErrors((current) => ({ ...current, volumeMl: undefined, abv: undefined }));
    setPresetRevision((revision) => revision + 1);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateDrinkInput({ volumeMl, abv, quantity, time });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onAdd({
      id: initialDrink?.id ?? createId(),
      type,
      volumeMl: Number(volumeMl),
      abv: Number(abv),
      quantity: Number(quantity),
      time: new Date(time).toISOString(),
    });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div>
        <h1 className="text-3xl font-black tracking-tight">
          {initialDrink ? "Редактировать напиток" : "Добавить напиток"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Укажите фактический объём, крепость и примерное время.
        </p>
      </div>
      <form onSubmit={submit} className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Быстрый выбор
        </label>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.type}
              onClick={() => choosePreset(preset)}
              className={`rounded-xl border px-2 py-3 text-xs font-semibold ${
                type === preset.type
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <NumberField key={`volume-${presetRevision}`} label="Объём, мл" value={volumeMl} min={1} max={5000} error={errors.volumeMl} onChange={(value) => { setVolume(value); setErrors((current) => ({ ...current, volumeMl: undefined })); }} />
          <NumberField key={`abv-${presetRevision}`} label="Крепость, %" value={abv} min={0.1} max={96} step={0.1} error={errors.abv} onChange={(value) => { setAbv(value); setErrors((current) => ({ ...current, abv: undefined })); }} />
          <NumberField key={`quantity-${presetRevision}`} label="Количество" value={quantity} min={1} max={100} error={errors.quantity} onChange={(value) => { setQuantity(value); setErrors((current) => ({ ...current, quantity: undefined })); }} />
        </div>
        <div className="mt-5">
          <label className="text-xs font-bold text-slate-600">Время употребления</label>
          <input
            type="datetime-local"
            required
            value={time}
            aria-invalid={Boolean(errors.time)}
            onChange={(event) => {
              setTime(event.target.value);
              setErrors((current) => ({ ...current, time: undefined }));
            }}
            className={`mt-2 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm outline-none ${
              errors.time ? "border-red-400 focus:border-red-500" : "border-slate-200 focus:border-slate-900"
            }`}
          />
          {errors.time && <p className="mt-1.5 text-[11px] font-medium text-red-600">{errors.time}</p>}
          {lastDrink && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              Предыдущий напиток:{" "}
              {new Date(lastDrink.time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <div className="mt-6 flex gap-2 border-t border-slate-100 pt-5">
          <button className="action-primary">
            {initialDrink ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {initialDrink ? "Сохранить" : "Добавить"}
          </button>
          <button type="button" onClick={onCancel} className="action-secondary">
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  error,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step?: number;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-bold text-slate-600">
      {label}
      <input
        type="number"
        required
        value={value}
        min={min}
        max={max}
        step={step}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm outline-none ${
          error ? "border-red-400 focus:border-red-500" : "border-slate-200 focus:border-slate-900"
        }`}
      />
      {error && <span className="mt-1.5 block text-[11px] font-medium text-red-600">{error}</span>}
    </label>
  );
}

function HistoryView({
  history,
  onDelete,
}: {
  history: DrinkingSession[];
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div>
      <h1 className="text-3xl font-black tracking-tight">История сессий</h1>
      <p className="mt-2 text-sm text-slate-500">Ваши завершённые сессии хранятся в Sites.</p>
      {history.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <History className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">История пока пуста.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {history.map((session) => {
            const open = expanded === session.id;
            return (
              <article key={session.id} className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                <button
                  onClick={() => setExpanded(open ? null : session.id)}
                  className="flex w-full items-center justify-between gap-3 p-5 text-left"
                >
                  <div>
                    <p className="text-sm font-bold">
                      {new Date(session.startTime).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {session.drinks.length} записей · {session.totalAlcoholGrams} г спирта
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <strong className="block text-sm">{(session.maxBac * 10).toFixed(2)} ‰</strong>
                      <span className="text-[10px] text-slate-400">расчётный пик</span>
                    </div>
                    {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </button>
                {open && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                    <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white">
                      {session.drinks.map((drink) => <DrinkRow key={drink.id} drink={drink} />)}
                    </div>
                    <button
                      onClick={() => onDelete(session.id)}
                      className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Удалить сессию
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProfileView({
  profile,
  user,
  onSave,
}: {
  profile: UserProfile;
  user: { displayName: string; email: string } | null;
  onSave: (profile: UserProfile) => void;
}) {
  const [draft, setDraft] = useState({
    weightKg: String(profile.weightKg),
    heightCm: String(profile.heightCm),
    age: String(profile.age),
    r: String(profile.r),
    gender: profile.gender,
  });
  const [genderRevision, setGenderRevision] = useState(0);
  const [errors, setErrors] = useState<ProfileInputErrors>({});
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateProfileInput(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave({
      weightKg: Number(draft.weightKg),
      heightCm: Number(draft.heightCm),
      age: Number(draft.age),
      r: Number(draft.r),
      gender: draft.gender,
    });
  };
  const gender = (value: UserProfile["gender"]) => {
    setGenderRevision((revision) => revision + 1);
    setDraft((current) => ({
      ...current,
      gender: value,
      r: String(value === "Male" ? 0.68 : value === "Female" ? 0.55 : 0.61),
    }));
    setErrors((current) => ({ ...current, r: undefined }));
  };
  return (
    <div>
      <h1 className="text-3xl font-black tracking-tight">Профиль</h1>
      <p className="mt-2 text-sm text-slate-500">Параметры используются только для расчёта BAC.</p>
      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <form onSubmit={submit} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm md:col-span-2">
          <h2 className="flex items-center gap-2 border-b border-slate-100 pb-4 text-base font-bold">
            <User className="h-5 w-5" /> Параметры тела
          </h2>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {(["Male", "Female", "Other"] as const).map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => gender(value)}
                className={`rounded-xl py-3 text-xs font-bold ${
                  draft.gender === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {value === "Male" ? "Мужской" : value === "Female" ? "Женский" : "Другой"}
              </button>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <NumberField label="Вес, кг" value={draft.weightKg} min={20} max={300} step={0.1} error={errors.weightKg} onChange={(value) => { setDraft({ ...draft, weightKg: value }); setErrors((current) => ({ ...current, weightKg: undefined })); }} />
            <NumberField label="Рост, см" value={draft.heightCm} min={50} max={250} step={0.1} error={errors.heightCm} onChange={(value) => { setDraft({ ...draft, heightCm: value }); setErrors((current) => ({ ...current, heightCm: undefined })); }} />
            <NumberField label="Возраст" value={draft.age} min={18} max={120} error={errors.age} onChange={(value) => { setDraft({ ...draft, age: value }); setErrors((current) => ({ ...current, age: undefined })); }} />
          </div>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <NumberField key={`widmark-${genderRevision}`} label="Коэффициент Видмарка (r)" value={draft.r} min={0.2} max={1.2} step={0.01} error={errors.r} onChange={(value) => { setDraft({ ...draft, r: value }); setErrors((current) => ({ ...current, r: undefined })); }} />
          </div>
          <button className="action-primary mt-5">
            <Save className="h-4 w-4" /> Сохранить профиль
          </button>
        </form>
        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <Cloud className="h-6 w-6 text-indigo-500" />
            {user ? (
              <>
                <h2 className="mt-3 text-sm font-bold">Аккаунт ChatGPT</h2>
                <p className="mt-2 truncate text-xs font-semibold">
                  {user.displayName}
                </p>
                <p className="truncate text-[11px] text-slate-400">{user.email}</p>
                <p className="mt-4 text-xs leading-5 text-slate-500">
                  Профиль, активная сессия и история синхронизируются между
                  устройствами.
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-3 text-sm font-bold">Локальный режим</h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Данные сохранены только в этом браузере. Войдите, чтобы
                  перенести их в облако и открыть на другом устройстве.
                </p>
                <a
                  href="/signin-with-chatgpt?return_to=%2F"
                  className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white"
                >
                  Войти и сохранить данные
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </>
            )}
          </div>
          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <p className="mt-3 text-xs leading-5 text-amber-900">
              Формула оценивает BAC статистически. Еда, лекарства, здоровье и индивидуальный метаболизм могут существенно изменить результат.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MigrationDialog({
  onMigrate,
  onLater,
}: {
  onMigrate: () => void;
  onLater: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="migration-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
    >
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Cloud className="h-6 w-6" />
        </div>
        <h2 id="migration-title" className="mt-4 text-xl font-black">
          Перенести локальные данные?
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Мы объединим локальный профиль, активную сессию и историю с вашим
          облачным аккаунтом. Совпадающие напитки и сессии не будут
          дублироваться.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button onClick={onMigrate} className="action-primary w-full py-3.5">
            <Cloud className="h-4 w-4" />
            Перенести и объединить
          </button>
          <button onClick={onLater} className="action-secondary w-full py-3.5">
            Не сейчас — оставить локально
          </button>
        </div>
      </section>
    </div>
  );
}
