"use client";

import { useLayoutEffect, useRef, type UIEvent } from "react";

export function useChatScroll(revision: number) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const followsTail = useRef(true);

  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    if (viewport && followsTail.current) viewport.scrollTop = viewport.scrollHeight;
  }, [revision]);

  function onScroll(event: UIEvent<HTMLDivElement>) {
    const { scrollHeight, clientHeight, scrollTop } = event.currentTarget;
    followsTail.current = scrollHeight - clientHeight - scrollTop <= 64;
  }

  return { ref: scrollRef, onScroll };
}
