import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import type { Farm } from '../types';
import { useAuth } from './AuthContext';

const ACTIVE_FARM_STORAGE_KEY = 'aadhunik_krishak_active_farm_id';

interface FarmContextValue {
  farms: Farm[];
  activeFarm: Farm | null;
  loading: boolean;
  error: string | null;
  setActiveFarm: (farm: Farm | null) => void;
  refreshFarms: (selectFarmId?: string) => Promise<void>;
}

const FarmContext = createContext<FarmContextValue | undefined>(undefined);

export function FarmProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [activeFarm, setActiveFarmState] = useState<Farm | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const setActiveFarm = useCallback((farm: Farm | null) => {
    setActiveFarmState(farm);
    try {
      if (farm) {
        localStorage.setItem(ACTIVE_FARM_STORAGE_KEY, farm.id);
      } else {
        localStorage.removeItem(ACTIVE_FARM_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors in restricted browser environments
    }
  }, []);

  const refreshFarms = useCallback(
    async (selectFarmId?: string) => {
      if (!user) {
        setFarms([]);
        setActiveFarmState(null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('farms')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('Failed to fetch farms:', fetchError.message);
        setError(fetchError.message);
        setFarms([]);
        setActiveFarmState(null);
        setLoading(false);
        return;
      }

      const farmList = (data as Farm[]) ?? [];
      setFarms(farmList);

      let savedId: string | null = selectFarmId ?? null;
      if (!savedId) {
        try {
          savedId = localStorage.getItem(ACTIVE_FARM_STORAGE_KEY);
        } catch {
          savedId = null;
        }
      }

      const matchedFarm =
        farmList.find((farm) => farm.id === savedId) ?? farmList[0] ?? null;

      setActiveFarm(matchedFarm);
      setLoading(false);
    },
    [user, setActiveFarm]
  );

  useEffect(() => {
    if (authLoading) return;
    void refreshFarms();
  }, [authLoading, refreshFarms]);

  return (
    <FarmContext.Provider
      value={{
        farms,
        activeFarm,
        loading,
        error,
        setActiveFarm,
        refreshFarms,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
}

export function useFarm(): FarmContextValue {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error('useFarm must be used inside a FarmProvider');
  }
  return context;
}