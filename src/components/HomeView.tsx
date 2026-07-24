import { useState, useEffect } from 'react';
import { useAppStore } from '../lib/store';
import {
  calculateAlcoholGrams,
  calculatePermille,
  calculateHoursToZero,
  getIntoxicationLevel,
  calculateDynamicBAC,
  generateBACTimeline
} from '../lib/bacCalculator';
import {
  Beer,
  GlassWater,
  Plus,
  Trash2,
  TrendingUp,
  Clock,
  ShieldAlert,
  CalendarCheck,
  Percent,
  CheckCircle,
  Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { motion } from 'motion/react';

export default function HomeView() {
  const {
    currentDrinks,
    profile,
    removeDrink,
    completeSession,
    setActiveTab
  } = useAppStore();

  const [now, setNow] = useState(new Date());

  // Keep BAC values ticking down in real time (every 10 seconds for smoothness)
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Compute active metrics
  const currentBac = calculateDynamicBAC(currentDrinks, profile.weightKg, profile.r, now);
  const currentPermille = calculatePermille(currentBac);
  const hoursToZero = calculateHoursToZero(currentBac);
  const level = getIntoxicationLevel(currentBac);

  // Total alcohol and volume consumed today
  const totalVolume = currentDrinks.reduce((sum, d) => sum + d.volumeMl * d.quantity, 0);
  const totalAlcoholGrams = currentDrinks.reduce((sum, d) => {
    return sum + calculateAlcoholGrams(d.volumeMl, d.abv) * d.quantity;
  }, 0);

  // Format hoursToZero into "X ч Y мин" or "Трезв"
  const formatSobrietyTime = (hours: number) => {
    if (hours <= 0) return 'Трезвый';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h} ч ${m} мин`;
  };

  // Estimated clock time of sobriety
  const sobrietyTime = new Date(now.getTime() + hoursToZero * 60 * 60 * 1000);
  const formattedSobrietyClock = sobrietyTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Gauge calculations (Max expected BAC is 0.30% for visual mapping)
  const MAX_GAUGE_BAC = 0.30;
  const gaugePercent = Math.min(1, currentBac / MAX_GAUGE_BAC);
  const circleRadius = 70;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - gaugePercent * circumference;

  // Prepare chart data
  const timelineData = generateBACTimeline(currentDrinks, profile.weightKg, profile.r);

  // Custom tooltips for Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-lg font-sans text-xs">
          <p className="font-semibold text-slate-800">Время: {data.timeLabel}</p>
          <p className="text-amber-600 font-mono font-bold mt-1">BAC: {data.bac}%</p>
          <p className="text-indigo-600 font-mono">Промилле: {data.permille} ‰</p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* 1. Main Dashboard Header / Overview Widget */}
      <div className="grid gap-6 md:grid-cols-3">
        
        {/* Left Widget: Large Circular BAC Gauge */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-6 shadow-xs text-center md:col-span-1">
          <h2 className="font-display text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Текущее состояние
          </h2>

          {/* SVG Circular Gauge */}
          <div className="relative flex items-center justify-center h-44 w-44">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 160 160">
              {/* Background Track */}
              <circle
                cx="80"
                cy="80"
                r={circleRadius}
                className="stroke-slate-100"
                strokeWidth="10"
                fill="transparent"
              />
              {/* Active Indicator */}
              <circle
                cx="80"
                cy="80"
                r={circleRadius}
                stroke={level.color}
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="animate-gauge transition-all duration-500"
              />
            </svg>

            {/* Inner Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <span className="font-display text-3xl font-extrabold tracking-tight text-slate-900">
                {currentBac.toFixed(3)}
              </span>
              <span className="font-sans text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
                BAC %
              </span>
              <div className="mt-2 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold bg-slate-50 text-slate-600">
                {currentPermille.toFixed(2)} ‰
              </div>
            </div>
          </div>

          {/* Intoxication Tag */}
          <div className="mt-5 w-full">
            <span
              className="inline-block rounded-full px-4 py-1 text-xs font-bold text-white shadow-xs"
              style={{ backgroundColor: level.color }}
            >
              {level.labelRu}
            </span>
            <p className="mt-2 font-sans text-xs text-slate-500 leading-relaxed px-2">
              {level.descriptionRu}
            </p>
          </div>
        </div>

        {/* Middle Widget: Metabolism, Sobriety Timer & Status Info */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-xs md:col-span-2">
          <div>
            <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-4">
              <h2 className="font-display text-sm font-semibold text-slate-500 uppercase tracking-wider">
                Скорость вытрезвления
              </h2>
              {currentDrinks.length > 0 && (
                <span className="rounded-md bg-amber-50 px-2 py-0.5 font-sans text-[10px] font-bold text-amber-700">
                  Активная сессия
                </span>
              )}
            </div>

            {/* sobriety counters */}
            <div className="grid gap-4 grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100/60">
                <span className="block font-sans text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Время до трезвости
                </span>
                <span className="mt-1 block font-display text-2xl font-black text-slate-800">
                  {formatSobrietyTime(hoursToZero)}
                </span>
                {hoursToZero > 0 && (
                  <span className="mt-1 flex items-center space-x-1 font-sans text-[11px] text-slate-500">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>Ориентировочно в {formattedSobrietyClock}</span>
                  </span>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100/60">
                <span className="block font-sans text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Выпито сегодня
                </span>
                <span className="mt-1 block font-display text-2xl font-black text-slate-800">
                  {totalAlcoholGrams.toFixed(1)} г
                </span>
                <span className="mt-1 block font-sans text-[11px] text-slate-500">
                  Общий объем: {totalVolume} мл
                </span>
              </div>
            </div>

            {/* Effects Box */}
            <div className="mt-4 rounded-xl border border-blue-50 bg-blue-50/30 p-4">
              <h4 className="font-sans text-xs font-bold text-blue-900 flex items-center space-x-1.5 uppercase tracking-wider">
                <ShieldAlert className="h-3.5 w-3.5 text-blue-600" />
                <span>Ожидаемые эффекты</span>
              </h4>
              <p className="mt-1 font-sans text-xs text-slate-600 leading-relaxed">
                {level.effectsRu}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-50 pt-4">
            <button
              onClick={() => setActiveTab('add-drink')}
              className="flex cursor-pointer items-center space-x-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-slate-800 active:scale-98 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Добавить напиток</span>
            </button>
            
            {currentDrinks.length > 0 && (
              <button
                onClick={completeSession}
                className="flex cursor-pointer items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-98"
              >
                <CalendarCheck className="h-4 w-4 text-emerald-600" />
                <span>Завершить сессию</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Visual BAC timeline chart */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-3">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-4.5 w-4.5 text-slate-500" />
            <h3 className="font-display font-bold text-sm text-slate-800">
              Проекция содержания алкоголя во времени
            </h3>
          </div>
          {currentDrinks.length > 0 && (
            <span className="font-sans text-[11px] text-slate-400">
              Интервал симуляции: 15 минут
            </span>
          )}
        </div>

        <div className="h-64 w-full">
          {currentDrinks.length === 0 ? (
            <div className="flex h-full w-full flex-col items-center justify-center rounded-xl bg-slate-50/50 text-center p-4">
              <Percent className="h-8 w-8 text-slate-300 mb-2" />
              <p className="font-sans text-xs font-medium text-slate-500 max-w-sm">
                График пуст, так как вы еще не добавили ни одного напитка в текущую сессию.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={timelineData}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorBac" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={level.color} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={level.color} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="timeLabel"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 'auto']}
                  dx={-5}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="bac"
                  stroke={level.color}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorBac)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 3. List of Active Drinks */}
      <div className="space-y-3">
        <h3 className="font-display text-base font-bold text-slate-800">
          Список напитков в текущей сессии
        </h3>

        {currentDrinks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center bg-white/60">
            <CheckCircle className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
            <h4 className="font-sans text-sm font-bold text-slate-800">Вы абсолютно трезвы</h4>
            <p className="font-sans text-xs text-slate-400 mt-1">
              Нажмите кнопку «Добавить напиток», чтобы зафиксировать первый бокал.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-2xs">
            {currentDrinks.map((drink) => {
              const drinkTimeStr = new Date(drink.time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              });
              const pureGrams = (
                drink.volumeMl *
                (drink.abv / 100) *
                0.789 *
                drink.quantity
              ).toFixed(1);

              return (
                <div
                  key={drink.id}
                  className="flex items-center justify-between p-4 hover:bg-slate-50/30 transition-colors"
                >
                  <div className="flex items-center space-x-3.5">
                    {/* Drink Icon graphic */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 border border-slate-100/60 shrink-0">
                      {drink.type === 'Beer' ? (
                        <Beer className="h-5 w-5 text-amber-500" />
                      ) : (
                        <GlassWater className="h-5 w-5 text-indigo-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-sans text-sm font-semibold text-slate-800">
                          {drink.type === 'Custom' ? 'Пользовательский напиток' : drink.type}
                        </span>
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500">
                          {drink.quantity} x {drink.volumeMl} мл
                        </span>
                      </div>
                      <p className="font-sans text-[11px] text-slate-400 flex items-center space-x-1.5 mt-0.5">
                        <Clock className="h-3 w-3" />
                        <span>Выпит в {drinkTimeStr}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {drink.abv}% ABV
                      </span>
                      <p className="font-sans text-[10px] text-slate-400">
                        {pureGrams} г этанола
                      </p>
                    </div>

                    <button
                      onClick={() => removeDrink(drink.id)}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Удалить напиток"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
