import type { Adapter, AdapterFormData } from '@/types/adapter';
interface AdapterState {
    adapters: Adapter[];
    loading: boolean;
    error: string | null;
    fetchAdapters: () => Promise<void>;
    createAdapter: (data: AdapterFormData) => Promise<Adapter>;
    updateAdapter: (id: string, data: Partial<AdapterFormData>) => Promise<void>;
    deleteAdapter: (id: string) => Promise<void>;
    toggleAdapter: (id: string) => Promise<void>;
    reconnectAdapter: (id: string) => Promise<void>;
    testConnection: (id: string) => Promise<{
        success: boolean;
        message: string;
    }>;
    clearError: () => void;
}
export declare const zustandAdapterStore: import("zustand").UseBoundStore<import("zustand").StoreApi<AdapterState>>;
export {};
