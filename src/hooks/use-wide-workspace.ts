import { useEffect, useState } from 'react';

/** Keep Radix keyboard direction aligned with the desktop side navigation. */
export function useWideWorkspace() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)');
    const update = () => setWide(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return wide;
}
