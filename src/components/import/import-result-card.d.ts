/**
 * C#30: Import Result Card — displays structured import results
 * (success/skipped/failed counts + detail list)
 */
import React from 'react';
export interface ImportDetailItem {
    name: string;
    status: 'success' | 'skipped' | 'failed';
    reason?: string;
}
export interface ImportResultData {
    success: number;
    skipped: number;
    failed: number;
    details: ImportDetailItem[];
}
interface Props {
    title: string;
    result: ImportResultData | null;
}
export declare const ImportResultCard: React.FC<Props>;
export default ImportResultCard;
