export type WorkspaceView = 'split' | 'card' | 'table';
export type WorkspaceViewPreference = WorkspaceView | 'auto';

// Keep in sync with the lg breakpoint used by the two-column workspaces.
export const WORKSPACE_WIDE_QUERY = '(min-width: 1024px)';

export function resolveWorkspaceView(preference: WorkspaceViewPreference, wide: boolean): WorkspaceView {
  return preference === 'auto' ? (wide ? 'split' : 'card') : preference;
}

export function readWorkspaceView(value: string | null, allowTable: boolean): WorkspaceViewPreference {
  return value === 'split' || value === 'card' || (allowTable && value === 'table') ? value : 'auto';
}
