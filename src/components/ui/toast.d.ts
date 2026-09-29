import * as React from 'react';
import { useToast, type Toast, type ToastVariant } from '@/hooks/use-toast';
export declare function ToastProvider({ children }: {
    children: React.ReactNode;
}): React.JSX.Element;
export { Toaster as ToastViewport } from './toaster';
export { useToast };
export type { Toast, ToastVariant };
