// Simple reactive store for app state
import { useState, useEffect } from 'react';

type Listener = () => void;

function createStore<T>(initialState: T) {
  let state = initialState;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    setState: (partial: Partial<T> | ((prev: T) => Partial<T>)) => {
      const update = typeof partial === 'function' ? partial(state) : partial;
      state = { ...state, ...update };
      listeners.forEach((l) => l());
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** SSR-safe hook — avoids useSyncExternalStore server snapshot issues */
export function useStore<T>(store: ReturnType<typeof createStore<T>>): T {
  const [snapshot, setSnapshot] = useState(() => store.getState());
  useEffect(() => {
    // Sync in case state changed between render and effect
    setSnapshot(store.getState());
    return store.subscribe(() => setSnapshot(store.getState()));
  }, [store]);
  return snapshot;
}

export type AppView = 'upload' | 'analyzing' | 'results' | 'history' | 'settings';

export interface AppState {
  view: AppView;
  currentAnalysisId: string | null;
  sidebarOpen: boolean;
  events: Array<{ event: string; data: any; ts: number }>;
  error: string | null;
  files: File[];
  uploading: boolean;
  rightPanelOpen: boolean;
}

export const appStore = createStore<AppState>({
  view: 'upload',
  currentAnalysisId: null,
  sidebarOpen: true,
  events: [],
  error: null,
  files: [],
  uploading: false,
  rightPanelOpen: true,
});
