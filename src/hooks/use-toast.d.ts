export type ToastVariant = 'default' | 'destructive';
export interface Toast {
    id: string;
    title: string;
    description?: string;
    variant: ToastVariant;
}
interface ToastState {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => string;
    removeToast: (id: string) => void;
    clearToasts: () => void;
}
export declare const zustandToastStore: import("zustand").UseBoundStore<import("zustand").StoreApi<ToastState>>;
/**
 * Toast notification hook.
 *
 * Returns a `toast` function that displays a notification.
 * The toast auto-dismisses after 5 seconds.
 *
 * @example
 * ```ts
 * const toast = useToast();
 * toast({ title: '保存成功', variant: 'default' });
 * toast({ title: '错误', description: '请稍后重试', variant: 'destructive' });
 * ```
 */
export declare function useToast(): (opts: {
    title: string;
    description?: string;
    variant?: ToastVariant;
}) => void;
export {};
