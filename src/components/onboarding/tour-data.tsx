import { createContext, useCallback, useContext, useState, type Dispatch, type SetStateAction } from 'react';

// A render-only projection: never seed the stores, API cache or database with
// samples. Keeping the live state mounted also preserves unsaved form drafts.
export const TourDataContext = createContext(false);
export const useTourActive = () => useContext(TourDataContext);

export function useTourValue<T>(live: T, sample: T): T {
  return useTourActive() ? sample : live;
}

export function useTourState<T>(initial: T | (() => T), sample: T): [T, Dispatch<SetStateAction<T>>] {
  const active = useTourActive();
  const [live, setLive] = useState(initial);
  // Effects derived from a sample (pagination, selection, etc.) must not alter
  // the hidden live draft. Requests started before the tour retain their live
  // setter and can finish normally while the sample is on screen.
  const setValue = useCallback<Dispatch<SetStateAction<T>>>((value) => {
    if (!active) setLive(value);
  }, [active]);
  return [active ? sample : live, setValue];
}
