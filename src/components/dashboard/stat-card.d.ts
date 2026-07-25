import React from 'react';
interface StatCardProps {
    icon: React.ComponentType<{
        className?: string;
    }>;
    label: string;
    value: string | number;
    trend?: {
        value: string;
        positive: boolean;
    };
}
export declare const StatCard: React.FC<StatCardProps>;
export default StatCard;
