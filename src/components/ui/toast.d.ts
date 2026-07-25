import * as React from 'react';
import { useToast, type Toast, type ToastVariant } from '@/hooks/use-toast';
export declare function ToastProvider({ children }: {
    children: React.ReactNode;
}): React.JSX.Element;
/**
 * Toast viewport — a fixed container at the bottom-right of the screen
 * that renders active toast notifications.
 */
declare function ToastViewport(): React.JSX.Element | null;
declare namespace ToastViewport {
    var displayName: string;
}
export { ToastViewport, useToast };
export type { Toast, ToastVariant };
