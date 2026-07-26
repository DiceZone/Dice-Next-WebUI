/**
 * Adapter type definitions.
 *
 * Describes the shape of bot-platform adapters (e.g. OneBot v11)
 * that connect Dice! to external chat platforms.
 */

export type ConnectionMode = 'forward_ws' | 'reverse_ws' | 'http';
export type AdapterStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'timeout';
export type AdapterType = 'onebot_v11' | 'qq_official';

export interface Adapter {
  id: string;
  name: string;
  type: AdapterType;
  connectionMode: ConnectionMode;
  endpoint: string;
  accessToken?: string;
  appId?: string;
  appSecret?: string;
  qqNumber?: string;
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
  accessToken?: string;
  appId?: string;
  appSecret?: string;
  qqNumber?: string;
  enabled?: boolean;
}
