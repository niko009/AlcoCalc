import { useState } from 'react';
import { useAppStore } from '../lib/store';
import { Calendar, Trash2, ChevronDown, ChevronUp, Clock, Info, Beer, GlassWater } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function HistoryView() {
  const { history, deleteSession } = useAppStore();
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  const toggleSessionExpand = (id: string) => {
    setExpandedSessionId((prev) => (prev === id ? null : id));
  };

  if (history.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center justify-center py-16 text-center space-y-4"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
          <Calendar className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h3 className="font-display text-lg font-bold text-slate-800">История пуста</h3>
          <p className="font-sans text-sm text-slate-500 max-w-sm mx-auto">
            Здесь будут отображаться ваши завершенные сессии употребления алкоголя и их подробная статистика.
          </p>
        </div>
      </motion.div>
    );
  }

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
          История сессий
        </h1>
        <p className="font-sans text-sm text-slate-500">
          Прошлые вечеринки, пиковые уровни алкоголя и время полного вытрезвления.
        </p>
      </div>

      <div className="space-y-4">
        {history.map((session) => {
          const isExpanded = expandedSessionId === session.id;
          const permille = (session.maxBac * 10).toFixed(2);
          const formattedDuration = session.durationHours < 1 
            ? `${Math.round(session.durationHours * 60)} мин` 
            : `${session.durationHours} ч`;

          return (
            <div
              key={session.id}
              className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xs transition-all hover:shadow-sm"
            >
              {/* Header Accordion Bar */}
              <div
                onClick={() => toggleSessionExpand(session.id)}
                className="flex cursor-pointer items-center justify-between p-5 hover:bg-slate-50/40 select-none"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-sans text-sm font-semibold text-slate-800">
                      {session.date}
                    </h3>
                    <p className="font-mono text-[10px] text-slate-500">
                      Напитков: {session.drinks.reduce((acc, d) => acc + d.quantity, 0)} • {session.totalAlcoholGrams} г этанола
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  {/* Stats Grid */}
                  <div className="hidden sm:flex items-center space-x-6 text-right">
                    <div>
                      <span className="block font-sans text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Пик BAC</span>
                      <span className="font-mono text-sm font-bold text-slate-800">{session.maxBac}%</span>
                    </div>
                    <div>
                      <span className="block font-sans text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Промилле</span>
                      <span className="font-mono text-sm font-bold text-slate-800">{permille} ‰</span>
                    </div>
                    <div>
                      <span className="block font-sans text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Длительность</span>
                      <span className="font-mono text-sm font-medium text-slate-600">{formattedDuration}</span>
                    </div>
                  </div>

                  {/* Mobile Compact stat display */}
                  <div className="sm:hidden text-right">
                    <span className="font-mono text-sm font-bold text-slate-800">{session.maxBac}%</span>
                    <span className="block font-mono text-[10px] text-slate-400">{permille} ‰</span>
                  </div>

                  {/* Accordion and delete triggers */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Удалить сессию"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Collapsible Content */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-slate-50 bg-slate-50/20"
                  >
                    <div className="p-5 space-y-4">
                      {/* Inner statistics grid for mobile */}
                      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 sm:hidden border border-slate-100">
                        <div className="text-center">
                          <span className="block font-sans text-[9px] uppercase tracking-wider text-slate-400">Пик BAC</span>
                          <span className="font-mono text-xs font-bold text-slate-700">{session.maxBac}%</span>
                        </div>
                        <div className="text-center">
                          <span className="block font-sans text-[9px] uppercase tracking-wider text-slate-400">Промилле</span>
                          <span className="font-mono text-xs font-bold text-slate-700">{permille} ‰</span>
                        </div>
                        <div className="text-center">
                          <span className="block font-sans text-[9px] uppercase tracking-wider text-slate-400">Время</span>
                          <span className="font-mono text-xs font-bold text-slate-700">{formattedDuration}</span>
                        </div>
                      </div>

                      {/* Drinks list title */}
                      <div className="space-y-2">
                        <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-400">
                          Список употреблённых напитков
                        </h4>

                        <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white shadow-2xs">
                          {session.drinks.map((drink) => {
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
                                className="flex items-center justify-between p-3.5 text-slate-700"
                              >
                                <div className="flex items-center space-x-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
                                    {drink.type === 'Beer' ? <Beer className="h-4.5 w-4.5 text-amber-500" /> : <GlassWater className="h-4.5 w-4.5 text-slate-500" />}
                                  </div>
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <span className="font-sans text-xs font-semibold text-slate-800">
                                        {drink.type === 'Custom' ? 'Пользовательский напиток' : drink.type}
                                      </span>
                                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500">
                                        {drink.quantity} x {drink.volumeMl} мл
                                      </span>
                                    </div>
                                    <p className="font-sans text-[10px] text-slate-400 flex items-center space-x-1">
                                      <Clock className="h-3 w-3" />
                                      <span>Выпит в {drinkTimeStr}</span>
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <span className="font-mono text-xs font-semibold text-slate-800">
                                    {drink.abv}% ABV
                                  </span>
                                  <p className="font-sans text-[10px] text-slate-400">
                                    {pureGrams} г чистого спирта
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
