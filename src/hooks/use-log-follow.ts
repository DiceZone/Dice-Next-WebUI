import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/** Follow the actual scroll container, without moving a reader viewing history. */
export function useLogFollow(contentVersion: unknown) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const [following, setFollowing] = useState(true);

  const scrollToLatest = useCallback(() => {
    const viewport = scrollRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, []);

  const onScroll = useCallback(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    // Allow fractional pixel rounding, but even a small upward scroll pauses.
    const atBottom = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 2;
    followingRef.current = atBottom;
    setFollowing(atBottom);
  }, []);

  const jumpToLatest = useCallback(() => {
    followingRef.current = true;
    setFollowing(true);
    scrollToLatest();
  }, [scrollToLatest]);

  // Run after the new rows are laid out and before the browser paints them.
  // This also handles the first asynchronous batch, not just the initial mount.
  useLayoutEffect(() => {
    if (followingRef.current) scrollToLatest();
  }, [contentVersion, scrollToLatest]);

  // Wrapping text, expanding diagnostics and responsive layouts change height
  // without changing the rows. Keep following only if the reader has not paused.
  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    const content = contentRef.current;
    if (!viewport || !content || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (followingRef.current) scrollToLatest();
    });
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollToLatest]);

  return { scrollRef, contentRef, following, onScroll, jumpToLatest };
}
