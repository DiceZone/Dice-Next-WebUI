import React from 'react';
import type { Adapter, AdapterFormData } from '@/types/adapter';
interface AdapterFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: AdapterFormData) => Promise<void>;
    adapter?: Adapter | null;
}
export declare const AdapterForm: React.FC<AdapterFormProps>;
export default AdapterForm;
