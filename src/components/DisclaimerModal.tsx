import { useAppStore } from '../lib/store';
import { ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function DisclaimerModal() {
  const { disclaimerAccepted, setDisclaimerAccepted } = useAppStore();

  if (disclaimerAccepted) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl md:p-8"
        >
          {/* Header Graphic */}
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <h2 className="font-display text-center text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            Важное предупреждение
          </h2>

          <div className="mt-4 space-y-3 font-sans text-sm leading-relaxed text-slate-600">
            <p>
              Все расчёты в данном приложении являются{' '}
              <strong className="font-semibold text-slate-900">приблизительными</strong> и основаны на математической формуле Видмарка.
            </p>
            <p>
              Реальный уровень алкоголя в крови зависит от множества факторов: скорости обмена веществ, сытости, общего состояния здоровья, принимаемых лекарств и других физиологических особенностей.
            </p>
            <p className="rounded-xl bg-amber-50 p-4 font-medium text-amber-900 border border-amber-100">
              ⚠️ Никогда не принимайте решение об управлении транспортными средствами или выполнении опасных работ, основываясь на данных этого калькулятора!
            </p>
          </div>

          <div className="mt-8">
            <button
              onClick={() => setDisclaimerAccepted(true)}
              className="flex w-full cursor-pointer items-center justify-center rounded-xl bg-slate-900 px-5 py-3.5 text-center font-semibold text-white transition-all hover:bg-slate-800 active:scale-98 shadow-md"
            >
              Я понимаю и согласен
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
