/**
 * Adapter type definitions.
 *
 * Describes the shape of bot-platform adapters (e.g. OneBot v11)
 * that connect Dice! to external chat platforms.
 */
export type ConnectionMode = 'forward_ws' | 'reverse_ws' | 'http';
export type AdapterStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'timeout';
export type AdapterType = 'onebot_v11' | 'milky' | 'qq_official' | 'discord' | 'kook';
export interface Adapter {
    id: string;
    name: string;
    type: AdapterType;
    connectionMode: ConnectionMode;
    endpoint: string;
    eventEndpoint?: string;
    accessToken?: string;
    appId?: string;
    appSecret?: string;
    qqNumber?: string;
    forceVerifyImageResource?: boolean;
    qqRichReplies?: 'off' | 'markdown' | 'math';
    qqInteractions?: 'off' | 'links' | 'buttons';
    personaSelection?: 'all' | 'selected' | 'none';
    selectablePersonaIds?: number[];
    defaultPersonaId?: number;
    heartApiKeyConfigured?: boolean;
    heartApiKeyTail?: string;
    enabled: boolean;
    status: AdapterStatus;
    lastActive?: string;
    createdAt: string;
    loginId?: string;
    loginName?: string;
}
export interface AdapterFormData {
    name: string;
    type: AdapterType;
    connectionMode: ConnectionMode;
    endpoint: string;
    eventEndpoint?: string;
    accessToken?: string;
    appId?: string;
    appSecret?: string;
    qqNumber?: string;
    forceVerifyImageResource?: boolean;
    qqRichReplies?: 'off' | 'markdown' | 'math';
    qqInteractions?: 'off' | 'links' | 'buttons';
    personaSelection?: 'all' | 'selected' | 'none';
    selectablePersonaIds?: number[];
    defaultPersonaId?: number;
    heartApiKey?: string;
    clearHeartApiKey?: boolean;
    enabled?: boolean;
}
