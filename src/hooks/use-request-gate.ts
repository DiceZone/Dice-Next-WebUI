import { useEffect, useRef } from 'react';
import { createRequestGate } from '@/lib/request-gate';

export function useRequestGate(key: string) {
  const gate = useRef(createRequestGate()).current;
  gate.select(key);
  useEffect(() => () => gate.invalidate(), [gate]);
  return gate;
}
