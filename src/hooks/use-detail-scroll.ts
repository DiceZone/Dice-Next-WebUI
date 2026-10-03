import { useEffect, useRef, type RefObject } from 'react';

// List/detail use one route. Preserve the actual scrolling panel, not just
// window.scrollY (the dashboard normally scrolls inside its main container).
export function useDetailScroll(root: RefObject<HTMLElement>) {
  const saved = useRef<{ panel: Element; top: number; trigger: HTMLElement | null }>();
  const frame = useRef<number>();
  useEffect(() => () => { if (frame.current !== undefined) cancelAnimationFrame(frame.current); }, []);
  const afterRender = (action: () => void) => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(action);
  };
  const open = (action: () => void) => {
    let panel: Element | null = root.current;
    while (panel && !/auto|scroll/.test(getComputedStyle(panel).overflowY)) panel = panel.parentElement;
    panel ??= document.scrollingElement;
    if (panel) saved.current = { panel, top: panel.scrollTop, trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null };
    action();
    if (panel) afterRender(() => { panel.scrollTop = 0; });
  };
  const close = (action: () => void) => {
    action();
    afterRender(() => {
      if (!saved.current) return;
      saved.current.panel.scrollTop = saved.current.top;
      if (saved.current.trigger?.isConnected) saved.current.trigger.focus({ preventScroll: true });
    });
  };
  return { open, close };
}
