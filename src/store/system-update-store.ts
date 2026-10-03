import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';
import type { UpdateStatus, VersionInfo } from '@/lib/system-update';

interface SystemUpdateState {
  status: UpdateStatus | null;
  version: VersionInfo | null;
  accept: (status: UpdateStatus) => void;
  invalidate: () => void;
  refresh: () => Promise<UpdateStatus>;
  loadVersion: () => Promise<void>;
}

let revision = 0;
let pending: Promise<UpdateStatus> | null = null;

export const useSystemUpdateStore = create<SystemUpdateState>((set, get) => ({
  status: null,
  version: null,
  accept: (status) => {
    revision++;
    set({ status, version: status.current });
  },
  invalidate: () => {
    revision++;
    pending = null;
  },
  refresh: () => {
    if (pending) return pending;
    const startedAt = revision;
    const request = apiClient.get<UpdateStatus>('/system/update', { timeoutMs: 10000 })
      .then((response) => {
        // A GET begun before an action must not undo its newer state.
        if (startedAt === revision) get().accept(response.data);
        return get().status ?? response.data;
      })
      .finally(() => { if (pending === request) pending = null; });
    pending = request;
    return request;
  },
  loadVersion: async () => {
    try {
      const response = await apiClient.get<VersionInfo>('/system/status', { timeoutMs: 10000 });
      if (!get().status) set({ version: response.data });
    } catch {
      // Leave unknown versions unknown, rather than displaying a fixed version.
    }
  },
}));
