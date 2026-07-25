import React from 'react';
import type { Adapter } from '@/types/adapter';
interface AdapterCardProps {
    adapter: Adapter;
    onConnect: (id: string) => void;
    onDisconnect: (id: string) => void;
    onReconnect: (id: string) => void;
    onEdit: (adapter: Adapter) => void;
    onDelete: (id: string) => void;
    onTestConnection: (id: string) => void;
    onShowReverseInfo?: (port: string) => void;
}
export declare const AdapterCard: React.FC<AdapterCardProps>;
export default AdapterCard;
