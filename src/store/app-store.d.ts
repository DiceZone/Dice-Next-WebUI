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
    initialized: boolean;
    sidebarCollapsed: boolean;
    theme: 'light' | 'dark' | 'system';
    apiKey: string | null;
    initialize: () => void;
    toggleSidebar: () => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    setApiKey: (key: string | null) => void;
}
export declare const zustandAppStore: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<AppState>, "persist"> & {
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<AppState, {
            sidebarCollapsed: boolean;
            theme: "light" | "dark" | "system";
        }>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: AppState) => void) => () => void;
        onFinishHydration: (fn: (state: AppState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<AppState, {
            sidebarCollapsed: boolean;
            theme: "light" | "dark" | "system";
        }>>;
    };
}>;
export {};
