// Central event log for mitigation-related events (research, launches, activations, etc.)
// Lightweight in-memory store similar to economy listeners pattern.

export type MitigationEventKind =
  | 'RESEARCH_STARTED'
  | 'RESEARCH_COMPLETED'
  | 'LAUNCH'
  | 'DEORBIT'
  | 'IMPACTOR_ACTIVATED'
  | 'LASER_ONLINE'
  | 'TELESCOPE_ONLINE'
  | 'BUILD_STARTED'
  | 'BUILD_COMPLETED'
  | 'LOCATION_CHANGE';

export interface MitigationEvent {
  id: string;
  timeMs: number;        // real clock timestamp
  simTimeSec?: number;   // optional simulation time if available
  kind: MitigationEventKind;
  label: string;         // short summary text
  details?: string;      // optional longer detail (not yet rendered)
  elapsedDays?: number;  // for completion events (sim time duration)
  highlight?: boolean;   // visually emphasized event
}

const _events: MitigationEvent[] = [];
const _listeners = new Set<() => void>();

export function getMitigationEvents(): MitigationEvent[] {
  return _events; // caller should not mutate; treat as read-only
}

export function addMitigationEvent(ev: Omit<MitigationEvent, 'id' | 'timeMs'> & { id?: string; timeMs?: number }): MitigationEvent {
  const full: MitigationEvent = {
    id: ev.id || (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8)),
    timeMs: ev.timeMs || Date.now(),
    kind: ev.kind,
    label: ev.label,
    details: ev.details,
    simTimeSec: ev.simTimeSec,
    elapsedDays: ev.elapsedDays,
    highlight: ev.highlight
  };
  // Newest-first storage: unshift so index 0 is most recent
  _events.unshift(full);
  // Limit length to avoid unbounded growth (tunable)
  if (_events.length > 500) _events.length = 500;
  for (const l of _listeners) l();
  return full;
}

export function subscribeMitigation(cb: () => void) {
  _listeners.add(cb);
  return () => { _listeners.delete(cb); };
}
