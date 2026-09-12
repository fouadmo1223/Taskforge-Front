import { useEffect, useRef } from 'react';
import type { RealtimeEvent, RealtimeMessage } from '@flowdesk/types';
import { realtime } from './ably';

/** Join a realtime room for the lifetime of the component. */
export function useRoom(room: string | null | undefined): void {
  useEffect(() => {
    if (!room) return;
    realtime.join(room);
    return () => realtime.leave(room);
  }, [room]);
}

/**
 * Subscribe to a realtime event. `handler` may be a fresh inline function on every
 * render — it's kept in a ref, so the actual Ably subscription only churns when
 * `event` itself changes, not on every re-render of the calling component.
 */
export function useRealtimeEvent<T = unknown>(
  event: RealtimeEvent,
  handler: (msg: RealtimeMessage<T>) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(
    () => realtime.on(event, (m) => handlerRef.current(m as RealtimeMessage<T>)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event],
  );
}
