export interface UpdateErrorNoticeState {
  persistent: string;
  transient: string;
  dismissed: string;
}

export type UpdateErrorNoticeEvent =
  | { type: 'operation-started' }
  | { type: 'operation-finished'; error?: string }
  | { type: 'poll-succeeded'; error?: string }
  | { type: 'poll-failed'; error: string }
  | { type: 'dismissed' };

export const INITIAL_UPDATE_ERROR_NOTICE: UpdateErrorNoticeState = {
  persistent: '',
  transient: '',
  dismissed: '',
};

const normalizeError = (error?: string) => error?.trim() ?? '';

export const getVisibleUpdateError = (state: UpdateErrorNoticeState) => (
  state.persistent || state.transient
);

/**
 * Keeps update-operation failures visible while allowing short-lived polling
 * failures to recover. A successful background poll must never erase an error
 * produced by an explicit check, download, install, or settings save.
 */
export const updateErrorNoticeReducer = (
  state: UpdateErrorNoticeState,
  event: UpdateErrorNoticeEvent,
): UpdateErrorNoticeState => {
  switch (event.type) {
    case 'operation-started':
      return INITIAL_UPDATE_ERROR_NOTICE;

    case 'operation-finished': {
      const error = normalizeError(event.error);
      return { persistent: error, transient: '', dismissed: '' };
    }

    case 'poll-succeeded': {
      const error = normalizeError(event.error);
      if (state.persistent || !error || error === state.dismissed) {
        return { ...state, transient: '' };
      }
      return { persistent: error, transient: '', dismissed: '' };
    }

    case 'poll-failed': {
      const error = normalizeError(event.error);
      if (!error || state.persistent || error === state.dismissed) {
        return { ...state, transient: '' };
      }
      return { ...state, transient: error };
    }

    case 'dismissed': {
      const visible = getVisibleUpdateError(state);
      return { persistent: '', transient: '', dismissed: visible || state.dismissed };
    }
  }
};
