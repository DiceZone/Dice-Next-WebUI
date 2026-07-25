import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Global application state store.
 *
 * Manages:
 * - Sidebar collapsed state
 * - Theme preference
 * - App initialization flag
 * - API Key storage
 */

interface AppState {
  // ─── State ────────────────────────────────────────────────
  initialized: boolean;
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  apiKey: string | null;

  // ─── Actions ──────────────────────────────────────────────
  initialize: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setApiKey: (key: string | null) => void;
}

export const zustandAppStore = create<AppState>()(
  persist(
    (set) => ({
      initialized: false,
      sidebarCollapsed: false,
      theme: 'system',
      apiKey: null,

      initialize: () => {
        // Load API key from localStorage (handled by api-client)
        const storedKey = localStorage.getItem('dice-api-key');
        set({
          initialized: true,
          apiKey: storedKey,
        });
      },

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed) =>
        set({ sidebarCollapsed: collapsed }),

      setTheme: (theme) => set({ theme }),

      setApiKey: (key) => {
        if (key) {
          localStorage.setItem('dice-api-key', key);
        } else {
          localStorage.removeItem('dice-api-key');
        }
        set({ apiKey: key });
      },
    }),
    {
      name: 'dice-app-store',
      // Only persist theme and sidebar preference
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
);
