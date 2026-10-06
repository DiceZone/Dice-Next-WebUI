import { useEffect, useRef } from 'react';

// Keep this aligned with Tailwind's md breakpoint. Only overlay state changes
// on resize; the selected tab and all form drafts belong to their existing owners.
export const WIDE_CONTROLS_QUERY = '(min-width: 768px)';

export function useCloseOnWideScreen(close: () => void) {
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => {
    const media = window.matchMedia(WIDE_CONTROLS_QUERY);
    const update = () => { if (media.matches) latest.current(); };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
}
