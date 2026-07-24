import React, { useState } from 'react';
import { useAppStore } from '../lib/store';
import { DrinkType } from '../types';
import { Beer, GlassWater, Wine, Flame, Martini, Sparkles, Plus, Minus, Check, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface Preset {
  type: DrinkType;
  labelRu: string;
  volumeMl: number;
  abv: number;
  icon: React.ComponentType<any>;
  color: string; // Theme styling colors
}

const PRESETS: Preset[] = [
  { type: 'Beer', labelRu: 'Пиво', volumeMl: 500, abv: 5, icon: Beer, color: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-150' },
  { type: 'Wine', labelRu: 'Вино', volumeMl: 150, abv: 12, icon: Wine, color: 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-150' },
  { type: 'Vodka', labelRu: 'Водка', volumeMl: 50, abv: 40, icon: Flame, color: 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-150' },
  { type: 'Whiskey', labelRu: 'Виски', volumeMl: 50, abv: 40, icon: Flame, color: 'bg-amber-900/10 text-amber-900 border-amber-950/20 hover:bg-amber-900/15' },
  { type: 'Cocktail', labelRu: 'Коктейль', volumeMl: 250, abv: 10, icon: Martini, color: 'bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-150' },
  { type: 'Champagne', labelRu: 'Шампанское', volumeMl: 150, abv: 12, icon: Sparkles, color: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-150' },
  { type: 'Cognac', labelRu: 'Коньяк', volumeMl: 50, abv: 40, icon: Flame, color: 'bg-orange-100 text-orange-950 border-orange-200 hover:bg-orange-150' },
  { type: 'Custom', labelRu: 'Свой', volumeMl: 100, abv: 15, icon: GlassWater, color: 'bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-150' }
];

export default function AddDrinkView() {
  const { addDrink, setActiveTab, currentDrinks } = useAppStore();

  const [type, setType] = useState<DrinkType>('Beer');
  const [volume, setVolume] = useState<number>(500);
  const [abv, setAbv] = useState<number>(5);
  const [quantity, setQuantity] = useState<number>(1);
  const [time, setTime] = useState<string>(() => {
    // Return local time in 'YYYY-MM-DDTHH:MM' format for the input
    const now = new Date();
    let initialDate = now;

    if (currentDrinks.length > 0) {
      // If there is a last drink, default to 30 minutes after it
      const lastTime = new Date(currentDrinks[currentDrinks.length - 1].time);
      initialDate = new Date(lastTime.getTime() + 30 * 60 * 1000);
    }

    const offsetMs = initialDate.getTimezoneOffset() * 60 * 1000;
    const localISOTime = new Date(initialDate.getTime() - offsetMs).toISOString().slice(0, 16);
    return localISOTime;
  });

  const lastDrink = currentDrinks.length > 0 ? currentDrinks[currentDrinks.length - 1] : null;
  const lastDrinkTime = lastDrink ? new Date(lastDrink.time) : null;
  const currentSelectedTime = new Date(time);

  const diffMinutes = lastDrinkTime 
    ? Math.round((currentSelectedTime.getTime() - lastDrinkTime.getTime()) / (60 * 1000))
    : 0;

  const adjustTimeByMinutes = (minutesOffset: number) => {
    if (!lastDrinkTime) return;
    const newDate = new Date(lastDrinkTime.getTime() + minutesOffset * 60 * 1000);
    const offsetMs = newDate.getTimezoneOffset() * 60 * 1000;
    const localISOTime = new Date(newDate.getTime() - offsetMs).toISOString().slice(0, 16);
    setTime(localISOTime);
  };

  const selectPreset = (preset: Preset) => {
    setType(preset.type);
    setVolume(preset.volumeMl);
    setAbv(preset.abv);
  };

  const handleIncrement = () => setQuantity((prev) => prev + 1);
  const handleDecrement = () => setQuantity((prev) => Math.max(1, prev - 1));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse time to local timestamp ISO string
    const dateObj = new Date(time);
    
    addDrink({
      type,
      volumeMl: volume,
      abv,
      quantity,
      time: dateObj.toISOString()
    });

    // Return to main dashboard
    setActiveTab('home');
  };

  const activePreset = PRESETS.find((p) => p.type === type);
  const ActiveIcon = activePreset ? activePreset.icon : GlassWater;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex flex-col space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
          Добавить напиток
        </h1>
        <p className="font-sans text-sm text-slate-500">
          Выберите готовый пресет или настройте крепость и объем вручную.
        </p>
      </div>

      {/* Preset Grid */}
      <div className="space-y-3">
        <h3 className="font-sans text-sm font-semibold text-slate-700">Быстрые пресеты</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isSelected = type === preset.type;
            return (
              <button
                key={preset.type}
                type="button"
                onClick={() => selectPreset(preset)}
                className={`relative flex cursor-pointer items-center space-x-3 rounded-2xl border p-3.5 transition-all outline-none ${
                  isSelected
                    ? 'border-slate-900 ring-2 ring-slate-900/10 scale-[1.02] bg-slate-900 text-white'
                    : `bg-white border-slate-100 hover:border-slate-300 ${preset.color}`
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  isSelected ? 'bg-white/10 text-white' : 'bg-white text-inherit shadow-xs'
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-left leading-tight">
                  <p className="font-sans text-xs font-semibold">{preset.labelRu}</p>
                  <p className={`font-mono text-[10px] ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                    {preset.volumeMl} мл • {preset.abv}%
                  </p>
                </div>
                {isSelected && (
                  <span className="absolute right-3 top-3 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white text-slate-900">
                    <Check className="h-3 w-3 stroke-[3px]" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Details */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Volume */}
            <div className="space-y-2">
              <label htmlFor="volInput" className="font-sans text-sm font-semibold text-slate-700">Объем (мл)</label>
              <div className="relative flex items-center">
                <input
                  id="volInput"
                  type="number"
                  min="1"
                  max="5000"
                  required
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-mono text-sm font-semibold text-slate-800 outline-none focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
                />
                <span className="absolute right-4 font-sans text-xs font-bold text-slate-400">мл</span>
              </div>
              {/* volume slider */}
              <input
                type="range"
                min="20"
                max="1000"
                step="10"
                value={volume > 1000 ? 1000 : volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-slate-900 h-1 cursor-pointer bg-slate-100 rounded-lg appearance-none"
              />
            </div>

            {/* ABV */}
            <div className="space-y-2">
              <label htmlFor="abvInput" className="font-sans text-sm font-semibold text-slate-700">Крепость (abv %)</label>
              <div className="relative flex items-center">
                <input
                  id="abvInput"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  value={abv}
                  onChange={(e) => setAbv(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-mono text-sm font-semibold text-slate-800 outline-none focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
                />
                <span className="absolute right-4 font-sans text-xs font-bold text-slate-400">%</span>
              </div>
              {/* ABV slider */}
              <input
                type="range"
                min="0.5"
                max="80"
                step="0.5"
                value={abv > 80 ? 80 : abv}
                onChange={(e) => setAbv(Number(e.target.value))}
                className="w-full accent-slate-900 h-1 cursor-pointer bg-slate-100 rounded-lg appearance-none"
              />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 border-t border-slate-50 pt-5">
            {/* Quantity */}
            <div className="space-y-2">
              <label className="font-sans text-sm font-semibold text-slate-700">Количество</label>
              <div className="flex h-[48px] max-w-[180px] items-center rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                <button
                  type="button"
                  onClick={handleDecrement}
                  disabled={quantity <= 1}
                  className="flex h-full w-14 cursor-pointer items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all border-r border-slate-200"
                >
                  <Minus className="h-4 w-4 stroke-[2.5px]" />
                </button>
                <div className="flex-1 text-center font-mono text-base font-bold text-slate-800">
                  {quantity}
                </div>
                <button
                  type="button"
                  onClick={handleIncrement}
                  className="flex h-full w-14 cursor-pointer items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-95 transition-all border-l border-slate-200"
                >
                  <Plus className="h-4 w-4 stroke-[2.5px]" />
                </button>
              </div>
            </div>

            {/* Time of Consumption */}
            <div className="space-y-2">
              <label htmlFor="timeInput" className="font-sans text-sm font-semibold text-slate-700 flex items-center space-x-1.5">
                <Clock className="h-4 w-4 text-slate-400" />
                <span>Время употребления</span>
              </label>
              <input
                id="timeInput"
                type="datetime-local"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 transition-all outline-none focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
              />

              {lastDrink && (
                <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/20 p-3 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-sans font-semibold text-slate-500 uppercase tracking-wider">
                      Интервал с прошлого напитка:
                    </span>
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-100/50 px-1.5 py-0.5 rounded">
                      {diffMinutes >= 0 
                        ? `+${Math.floor(diffMinutes / 60) > 0 ? `${Math.floor(diffMinutes / 60)} ч ` : ''}${diffMinutes % 60} мин`
                        : `${diffMinutes} мин (назад)`
                      }
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => adjustTimeByMinutes(15)}
                      className="cursor-pointer rounded-lg bg-white border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
                    >
                      15м
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustTimeByMinutes(30)}
                      className="cursor-pointer rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-1 text-[10px] font-bold hover:bg-indigo-150 active:scale-95 transition-all"
                    >
                      30м (деф)
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustTimeByMinutes(45)}
                      className="cursor-pointer rounded-lg bg-white border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
                    >
                      45м
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustTimeByMinutes(60)}
                      className="cursor-pointer rounded-lg bg-white border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
                    >
                      1ч
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustTimeByMinutes(90)}
                      className="cursor-pointer rounded-lg bg-white border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
                    >
                      1.5ч
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustTimeByMinutes(120)}
                      className="cursor-pointer rounded-lg bg-white border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
                    >
                      2ч
                    </button>
                  </div>

                  <div className="flex items-center space-x-1.5 text-[10px] text-slate-500">
                    <span className="font-sans">Или вручную (минут):</span>
                    <input
                      type="number"
                      min="0"
                      max="1440"
                      value={diffMinutes < 0 ? 0 : diffMinutes}
                      onChange={(e) => adjustTimeByMinutes(Number(e.target.value))}
                      className="w-14 rounded border border-slate-200 bg-white px-1 py-0.5 text-center font-mono font-bold text-slate-800 outline-none focus:border-indigo-500"
                    />
                    <span className="truncate max-w-[130px]" title={`Прошлый: ${lastDrink.type} в ${new Date(lastDrink.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}>
                      после {lastDrink.type}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 border-t border-slate-100 pt-6">
            <button
              type="submit"
              className="flex w-full sm:w-auto cursor-pointer items-center justify-center space-x-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 active:scale-98 shadow-md"
            >
              <Plus className="h-4 w-4" />
              <span>Добавить во вчера/сегодня</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="flex w-full sm:w-auto cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50 active:scale-98"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
