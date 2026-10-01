/** Versioned, bounded tracking definitions. Hosts persist only rejection categories,
 * never rejected values or raw payloads. Authorization remains a host boundary. */
export type TrackingField = {
  kind: 'string' | 'number' | 'boolean';
  required?: boolean;
  values?: readonly string[];
  maximum?: number;
  minimum?: number;
};
export type TrackingDefinition = {
  event: string;
  version: number;
  label: string;
  owner: string;
  source: 'server' | 'browser';
  consent: boolean;
  retentionDays: number;
  meaning: string;
  fields: Readonly<Record<string, TrackingField>>;
};
export type TrackingViolation = 'unknown-event' | 'unsupported-version' | 'invalid-payload' | 'unknown-field' | 'missing-field' | 'invalid-field';
export const defineTrackingCatalog = (definitions: readonly TrackingDefinition[]): readonly TrackingDefinition[] => {
  const keys = new Set<string>();
  for (const item of definitions) {
    const key = `${item.event}:${item.version}`;
    if (!/^[a-z][a-z0-9.-]{0,63}$/.test(item.event) || !Number.isInteger(item.version) || item.version < 1 || keys.has(key) || !item.owner.trim() || !item.meaning.trim() || !Number.isInteger(item.retentionDays) || item.retentionDays < 1)
      throw new Error('Invalid tracking definition');
    keys.add(key);
    for (const [name, field] of Object.entries(item.fields)) {
      if (!/^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(name) || (field.minimum !== undefined && !Number.isFinite(field.minimum)) || (field.maximum !== undefined && !Number.isFinite(field.maximum)) || (field.minimum !== undefined && field.maximum !== undefined && field.minimum > field.maximum))
        throw new Error('Invalid tracking field');
    }
  }
  return Object.freeze(definitions.map(item => Object.freeze({...item, fields: Object.freeze(Object.fromEntries(Object.entries(item.fields).map(([name, field]) => [name, Object.freeze({...field, ...(field.values ? {values: Object.freeze([...field.values])} : {})})])))})));
};
export const validateTrackingEvent = (catalog: readonly TrackingDefinition[], event: string, version: number, payload: unknown): TrackingViolation | null => {
  const versions = catalog.filter(item => item.event === event);
  if (!versions.length) return 'unknown-event';
  const definition = versions.find(item => item.version === version);
  if (!definition) return 'unsupported-version';
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'invalid-payload';
  const values = Object.entries(payload);
  if (values.some(([key]) => !Object.hasOwn(definition.fields, key))) return 'unknown-field';
  for (const [key, field] of Object.entries(definition.fields)) {
    const value = values.find(([name]) => name === key)?.[1];
    if (value === undefined) { if (field.required) return 'missing-field'; continue; }
    if (typeof value !== field.kind) return 'invalid-field';
    if (typeof value === 'number' && (!Number.isFinite(value) || (field.minimum !== undefined && value < field.minimum) || (field.maximum !== undefined && value > field.maximum))) return 'invalid-field';
    if (typeof value === 'string' && (value.length > (field.maximum ?? 256) || (field.minimum !== undefined && value.length < field.minimum) || (field.values && !field.values.includes(value)))) return 'invalid-field';
  }
  return null;
};
export const trackingCoverage = (input: {startedAt: number | null; lastReceivedAt: number | null; asOf: number; staleAfterMs: number; expected: boolean}) => {
  if (input.startedAt === null || input.startedAt > input.asOf) return 'not-started' as const;
  if (input.lastReceivedAt === null) return input.expected && input.asOf - input.startedAt >= input.staleAfterMs ? 'missing' as const : 'awaiting-data' as const;
  if (input.lastReceivedAt > input.asOf) return 'invalid-clock' as const;
  return input.expected && input.asOf - input.lastReceivedAt >= input.staleAfterMs ? 'stale' as const : 'observed' as const;
};
