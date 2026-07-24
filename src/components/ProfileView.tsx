import React, { useState, useEffect } from 'react';
import { useAppStore } from '../lib/store';
import { User, Settings, Info, Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

export default function ProfileView() {
  const { profile, updateProfile, resetAll } = useAppStore();
  
  const [weight, setWeight] = useState(profile.weightKg);
  const [height, setHeight] = useState(profile.heightCm);
  const [age, setAge] = useState(profile.age);
  const [gender, setGender] = useState(profile.gender);
  const [r, setR] = useState(profile.r);
  
  const [isSaved, setIsSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Sync state if profile in store changes
  useEffect(() => {
    setWeight(profile.weightKg);
    setHeight(profile.heightCm);
    setAge(profile.age);
    setGender(profile.gender);
    setR(profile.r);
  }, [profile]);

  const handleGenderChange = (selectedGender: 'Male' | 'Female' | 'Other') => {
    setGender(selectedGender);
    // Auto-calculate default r
    let defaultR = 0.61;
    if (selectedGender === 'Male') defaultR = 0.68;
    if (selectedGender === 'Female') defaultR = 0.55;
    setR(defaultR);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      weightKg: Number(weight),
      heightCm: Number(height),
      age: Number(age),
      gender,
      r: Number(r)
    });
    
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const triggerReset = () => {
    if (showResetConfirm) {
      resetAll();
      setShowResetConfirm(false);
    } else {
      setShowResetConfirm(true);
    }
  };

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
          Профиль пользователя
        </h1>
        <p className="font-sans text-sm text-slate-500">
          Параметры тела используются для вычисления скорости усвоения и выведения алкоголя.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Settings Form */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:col-span-2">
          <div className="mb-6 flex items-center space-x-3 border-b border-slate-100 pb-4">
            <Settings className="h-5 w-5 text-slate-600" />
            <h2 className="font-display text-lg font-semibold text-slate-800">
              Личные параметры
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Gender Switcher */}
            <div className="space-y-2">
              <label className="font-sans text-sm font-medium text-slate-700">Пол</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Male', 'Female', 'Other'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => handleGenderChange(g)}
                    className={`flex cursor-pointer items-center justify-center rounded-xl py-3 text-sm font-medium transition-all ${
                      gender === g
                        ? 'bg-slate-900 text-white font-semibold shadow-sm'
                        : 'bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100'
                    }`}
                  >
                    {g === 'Male' && 'Мужской'}
                    {g === 'Female' && 'Женский'}
                    {g === 'Other' && 'Другой'}
                  </button>
                ))}
              </div>
            </div>

            {/* Weight, Height, Age Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="weight" className="font-sans text-xs font-semibold text-slate-600">
                  Вес (кг)
                </label>
                <input
                  id="weight"
                  type="number"
                  required
                  min="20"
                  max="300"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 transition-all focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="height" className="font-sans text-xs font-semibold text-slate-600">
                  Рост (см)
                </label>
                <input
                  id="height"
                  type="number"
                  required
                  min="50"
                  max="250"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 transition-all focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="age" className="font-sans text-xs font-semibold text-slate-600">
                  Возраст
                </label>
                <input
                  id="age"
                  type="number"
                  required
                  min="16"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 transition-all focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900 outline-none"
                />
              </div>
            </div>

            {/* Widmark Coefficient (r) */}
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <label htmlFor="factor" className="font-sans text-xs font-bold text-slate-700">
                    Коэффициент Widmark (r)
                  </label>
                  <p className="font-sans text-[11px] leading-snug text-slate-500 max-w-sm">
                    Определяет процент жидкости в массе тела. Автоматически пересчитывается при смене пола, но вы можете отрегулировать его вручную.
                  </p>
                </div>
                <input
                  id="factor"
                  type="number"
                  step="0.01"
                  min="0.2"
                  max="1.2"
                  value={r}
                  onChange={(e) => setR(Number(e.target.value))}
                  className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center font-mono text-xs font-bold text-slate-800 outline-none focus:border-slate-900"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center space-x-3">
              <button
                type="submit"
                className="flex cursor-pointer items-center justify-center space-x-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 active:scale-98 shadow-sm"
              >
                <Save className="h-4 w-4" />
                <span>Сохранить профиль</span>
              </button>

              {isSaved && (
                <span className="font-sans text-xs font-medium text-emerald-600">
                  Профиль успешно обновлен!
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Info & Utility Panel */}
        <div className="space-y-4">
          {/* Widmark explanation card */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-slate-700">
              <Info className="h-5 w-5 text-slate-500" />
              <h3 className="font-display font-semibold text-sm">Справка</h3>
            </div>
            
            <div className="font-sans text-xs text-slate-600 space-y-3 leading-relaxed">
              <p>
                Формула шведского химика Эрика Видмарка — это золотой стандарт судебной и медицинской практики для вычисления содержания алкоголя в крови.
              </p>
              <p>
                <strong className="text-slate-800 font-medium">Стандартные коэффициенты (r):</strong>
                <br />• Мужчины: <code className="font-mono bg-slate-100 px-1 rounded text-slate-800 font-semibold">0.68</code> (в среднем от 0.60 до 0.80)
                <br />• Женщины: <code className="font-mono bg-slate-100 px-1 rounded text-slate-800 font-semibold">0.55</code> (в среднем от 0.50 до 0.65)
                <br />• По умолчанию: <code className="font-mono bg-slate-100 px-1 rounded text-slate-800 font-semibold">0.61</code>
              </p>
              <p>
                Пониженный вес или более высокий процент жира в организме снижают коэффициент, увеличивая концентрацию алкоголя (BAC) при той же дозе.
              </p>
            </div>
          </div>

          {/* Reset Application Card */}
          <div className="rounded-2xl border border-red-100 bg-red-50/40 p-6 shadow-sm space-y-3">
            <h3 className="font-display font-semibold text-sm text-red-900 flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span>Опасная зона</span>
            </h3>
            
            <p className="font-sans text-[11px] text-slate-600 leading-normal">
              Удаление всей истории, текущих напитков и сброс настроек до заводских. Это действие необратимо.
            </p>

            <button
              onClick={triggerReset}
              onMouseLeave={() => setShowResetConfirm(false)}
              className={`flex w-full cursor-pointer items-center justify-center space-x-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${
                showResetConfirm
                  ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                  : 'bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{showResetConfirm ? 'Да, сбросить всё' : 'Сбросить все данные'}</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
