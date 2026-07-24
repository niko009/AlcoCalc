import { create } from 'zustand';
import { Drink, UserProfile, Session, DrinkType } from '../types';
import { calculateAlcoholGrams, calculateDynamicBAC } from './bacCalculator';

interface AppState {
  profile: UserProfile;
  currentDrinks: Drink[];
  history: Session[];
  disclaimerAccepted: boolean;
  activeTab: 'home' | 'add-drink' | 'history' | 'profile';
  
  // Actions
  updateProfile: (profile: Partial<UserProfile>) => void;
  addDrink: (drink: Omit<Drink, 'id'>) => void;
  removeDrink: (id: string) => void;
  clearCurrentDrinks: () => void;
  completeSession: () => void;
  deleteSession: (id: string) => void;
  setDisclaimerAccepted: (accepted: boolean) => void;
  setActiveTab: (tab: 'home' | 'add-drink' | 'history' | 'profile') => void;
  resetAll: () => void;
}

const DEFAULT_PROFILE: UserProfile = {
  weightKg: 75,
  heightCm: 175,
  age: 28,
  gender: 'Male',
  r: 0.68
};

// Helper to load from localStorage with fallback
const getLocalStorage = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
};

const setLocalStorage = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving to localStorage', e);
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  profile: getLocalStorage<UserProfile>('bac_profile', DEFAULT_PROFILE),
  currentDrinks: getLocalStorage<Drink[]>('bac_current_drinks', []),
  history: getLocalStorage<Session[]>('bac_history', []),
  disclaimerAccepted: getLocalStorage<boolean>('bac_disclaimer_accepted', false),
  activeTab: 'home',

  updateProfile: (updated) => {
    set((state) => {
      const newProfile = { ...state.profile, ...updated };
      
      // Auto-update Widmark r if gender changed and r is not manually set to something else,
      // or if they explicitly change the gender.
      if (updated.gender && !updated.r) {
        if (updated.gender === 'Male') newProfile.r = 0.68;
        else if (updated.gender === 'Female') newProfile.r = 0.55;
        else newProfile.r = 0.61;
      }
      
      setLocalStorage('bac_profile', newProfile);
      return { profile: newProfile };
    });
  },

  addDrink: (newDrinkData) => {
    set((state) => {
      const newDrink: Drink = {
        ...newDrinkData,
        id: crypto.randomUUID()
      };
      const updatedDrinks = [...state.currentDrinks, newDrink].sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
      );
      setLocalStorage('bac_current_drinks', updatedDrinks);
      return { currentDrinks: updatedDrinks };
    });
  },

  removeDrink: (id) => {
    set((state) => {
      const updatedDrinks = state.currentDrinks.filter((d) => d.id !== id);
      setLocalStorage('bac_current_drinks', updatedDrinks);
      return { currentDrinks: updatedDrinks };
    });
  },

  clearCurrentDrinks: () => {
    setLocalStorage('bac_current_drinks', []);
    set({ currentDrinks: [] });
  },

  completeSession: () => {
    const { currentDrinks, profile, history } = get();
    if (currentDrinks.length === 0) return;

    // Calculate session stats
    const times = currentDrinks.map((d) => new Date(d.time).getTime());
    const startTimeStr = new Date(Math.min(...times)).toISOString();
    const endTimeStr = new Date(Math.max(...times)).toISOString();

    // Determine max BAC reached during the session.
    // We can simulate BAC from start time until 16 hours later at 15-minute intervals
    let maxBac = 0;
    const startMs = Math.min(...times);
    const endSimulationMs = Math.max(...times) + 16 * 60 * 60 * 1000;
    
    for (let ms = startMs; ms <= endSimulationMs; ms += 15 * 60 * 1000) {
      const currentBac = calculateDynamicBAC(currentDrinks, profile.weightKg, profile.r, new Date(ms));
      if (currentBac > maxBac) {
        maxBac = currentBac;
      }
    }

    const totalAlcoholGrams = currentDrinks.reduce((sum, drink) => {
      return sum + calculateAlcoholGrams(drink.volumeMl, drink.abv) * drink.quantity;
    }, 0);

    const durationHours = (Math.max(...times) - Math.min(...times)) / (1000 * 60 * 60);

    const dateLabel = new Date(startTimeStr).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const newSession: Session = {
      id: crypto.randomUUID(),
      date: dateLabel,
      startTime: startTimeStr,
      endTime: endTimeStr,
      maxBac: parseFloat(maxBac.toFixed(4)),
      durationHours: parseFloat(durationHours.toFixed(2)),
      totalAlcoholGrams: parseFloat(totalAlcoholGrams.toFixed(2)),
      drinks: currentDrinks,
      isCompleted: true
    };

    const updatedHistory = [newSession, ...history];
    setLocalStorage('bac_history', updatedHistory);
    setLocalStorage('bac_current_drinks', []);
    
    set({
      history: updatedHistory,
      currentDrinks: [],
      activeTab: 'history'
    });
  },

  deleteSession: (id) => {
    set((state) => {
      const updatedHistory = state.history.filter((s) => s.id !== id);
      setLocalStorage('bac_history', updatedHistory);
      return { history: updatedHistory };
    });
  },

  setDisclaimerAccepted: (accepted) => {
    setLocalStorage('bac_disclaimer_accepted', accepted);
    set({ disclaimerAccepted: accepted });
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },

  resetAll: () => {
    localStorage.removeItem('bac_profile');
    localStorage.removeItem('bac_current_drinks');
    localStorage.removeItem('bac_history');
    localStorage.removeItem('bac_disclaimer_accepted');
    set({
      profile: DEFAULT_PROFILE,
      currentDrinks: [],
      history: [],
      disclaimerAccepted: false,
      activeTab: 'home'
    });
  }
}));
