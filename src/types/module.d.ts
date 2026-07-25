/**
 * Module type definitions.
 *
 * Plugin-like modules that extend bot functionality.
 */
export type ModuleType = 'dice' | 'reply' | 'deck' | 'session' | 'custom';
export interface Module {
    id: string;
    name: string;
    description: string;
    type: ModuleType;
    version: string;
    enabled: boolean;
    config: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
export interface ModuleFormData {
    name: string;
    description: string;
    type: ModuleType;
    config?: Record<string, unknown>;
}
