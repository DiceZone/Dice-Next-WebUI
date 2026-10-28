/**
 * Adapter type definitions.
 *
 * Describes the shape of bot-platform adapters (e.g. OneBot v11)
 * that connect Dice! to external chat platforms.
 */
export type ConnectionMode = 'forward_ws' | 'reverse_ws' | 'http';
export type AdapterStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'timeout';
/** openopq = 内置登录（实验性）：由 Dice!Next 自行运行协议端，网页扫码登录。 */
export type AdapterType = 'onebot_v11' | 'milky' | 'qq_official' | 'discord' | 'kook' | 'openopq';
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
    /** 内置登录与协议端之间的连接方式 */
    openopqTransport?: 'forward_ws' | 'reverse_ws';
    forceVerifyImageResource?: boolean;
    subscribeGroupMemberEvents?: boolean;
    autoAcknowledgeInteractions?: boolean;
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
    openopqTransport?: 'forward_ws' | 'reverse_ws';
    forceVerifyImageResource?: boolean;
    subscribeGroupMemberEvents?: boolean;
    autoAcknowledgeInteractions?: boolean;
    qqRichReplies?: 'off' | 'markdown' | 'math';
    qqInteractions?: 'off' | 'links' | 'buttons';
    personaSelection?: 'all' | 'selected' | 'none';
    selectablePersonaIds?: number[];
    defaultPersonaId?: number;
    heartApiKey?: string;
    clearHeartApiKey?: boolean;
    enabled?: boolean;
}
