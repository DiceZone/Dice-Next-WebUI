interface ConfirmOpts {
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
}
interface PromptOpts {
    title: string;
    description?: string;
    defaultValue?: string;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
}
/**
 * Styled confirm()/prompt() replacements for the native browser dialogs.
 * Both return a Promise; `confirm` → boolean, `prompt` → string | null.
 *
 *   const dlg = useDialogs();
 *   if (await dlg.confirm({ title: '...' })) { ... }
 *   const v = await dlg.prompt({ title: '...', defaultValue: 'x' });
 *
 * Render `dlg.node` once somewhere in the component tree.
 */
export declare function useDialogs(t?: (k: string) => string): {
    confirm: (opts: ConfirmOpts) => Promise<boolean>;
    prompt: (opts: PromptOpts) => Promise<string | null>;
    node: import("react").JSX.Element;
};
export {};
