/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useAppStore } from './lib/store';
import HomeView from './components/HomeView';
import AddDrinkView from './components/AddDrinkView';
import HistoryView from './components/HistoryView';
import ProfileView from './components/ProfileView';
import DisclaimerModal from './components/DisclaimerModal';

import { Home, Beer, ClipboardList, User, ShieldAlert, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const { activeTab, setActiveTab } = useAppStore();

  const navItems = [
    { id: 'home', label: 'Главная', icon: Home },
    { id: 'add-drink', label: 'Добавить', icon: Beer },
    { id: 'history', label: 'История', icon: ClipboardList },
    { id: 'profile', label: 'Профиль', icon: User },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-slate-900 selection:text-white">
      {/* 1. Global Safety Warnings or Top Alerts (Optional & Clean) */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
              <Award className="h-5 w-5 stroke-[2.5px]" />
            </div>
            <div>
              <span className="font-display text-base font-extrabold tracking-tight text-slate-900">
                BAC Calculator
              </span>
              <span className="ml-1.5 hidden rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500 sm:inline">
                Widmark v1.2
              </span>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden sm:flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200/50">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex cursor-pointer items-center space-x-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all outline-none ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* 2. Main Container with Responsive Padding */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 pb-28 pt-6 sm:pb-12">
        <AnimatePresence mode="wait">
          <div key={activeTab}>
            {activeTab === 'home' && <HomeView />}
            {activeTab === 'add-drink' && <AddDrinkView />}
            {activeTab === 'history' && <HistoryView />}
            {activeTab === 'profile' && <ProfileView />}
          </div>
        </AnimatePresence>
      </main>

      {/* 3. Bottom Mobile Finger-Friendly Navigation Rail */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-100 bg-white/95 backdrop-blur-md px-2 py-2 sm:hidden shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.06)]">
        <div className="grid grid-cols-4 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-2 rounded-xl transition-all outline-none select-none active:scale-95 ${
                  isActive
                    ? 'text-slate-900 font-bold bg-slate-50'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="relative">
                  <Icon className={`h-5.5 w-5.5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                </div>
                <span className="font-sans text-[10px] mt-1 font-medium tracking-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 4. Disclaimer Overlay on First Open */}
      <DisclaimerModal />
    </div>
  );
}
