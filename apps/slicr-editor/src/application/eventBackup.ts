import type {DcbEvent, SpecEventStore} from '../domain/eventSourcing';
import type {NodeType} from '../graph/types';

export type EventBackupAdminStore = {
  restoreBackup(events: readonly DcbEvent[]): Promise<void>;
};

export type EventBackupService = {
  backupText(): Promise<string>;
  restoreFrom(backup: string): Promise<void>;
};

export type EventBackupV1 = {
  version: 1;
  events: DcbEvent[];
};

export type ParseEventBackupResult = {ok: true; events: DcbEvent[]} | {ok: false; error: string};

export function createEventBackupService(args: {store: SpecEventStore<DcbEvent>; adminStore: EventBackupAdminStore}): EventBackupService {
  return {
    async backupText() {
      const events = (await args.store.read()).map(({event}) => event);
      return serializeEventBackup(events);
    },
    async restoreFrom(backup: string) {
      const result = parseEventBackup(backup);
      if (!result.ok) {
        throw new Error(result.error);
      }

      await args.adminStore.restoreBackup(result.events);
    },
  };
}

export function serializeEventBackup(events: readonly DcbEvent[]): string {
  return JSON.stringify({version: 1, events});
}

export function parseEventBackup(input: string): ParseEventBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return {ok: false, error: 'Backup must be valid JSON.'};
  }

  if (Array.isArray(parsed)) {
    return {ok: false, error: 'Backup must use the version 1 event-backup format, not a bare event array.'};
  }

  if (!parsed || typeof parsed !== 'object') {
    return {ok: false, error: 'Backup must be an object with version 1 metadata and events.'};
  }

  const candidate = parsed as Partial<EventBackupV1> & Record<string, unknown>;
  if (candidate.version !== 1) {
    return {ok: false, error: 'Backup version is unsupported. Expected version 1.'};
  }

  if (!Array.isArray(candidate.events)) {
    return {ok: false, error: 'Backup version 1 must include an events array.'};
  }

  const invalidIndex = candidate.events.findIndex((event) => !isDomainEvent(event));
  if (invalidIndex >= 0) {
    return {ok: false, error: `Backup contains an invalid event at index ${invalidIndex}.`};
  }

  return {ok: true, events: candidate.events};
}

function isDomainEvent(event: unknown): event is DcbEvent {
  if (!event || typeof event !== 'object') {
    return false;
  }

  const candidate = event as Partial<DcbEvent>;
  return (
    typeof candidate.type === 'string' &&
    isKnownEventType(candidate.type) &&
    isEventPayload(candidate.type, candidate.payload) &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every((tag: unknown) => typeof tag === 'string')
  );
}

function isKnownEventType(type: string): type is DcbEvent['type'] {
  return (
    type === 'NodeAdded' ||
    type === 'NodeChapterChanged' ||
    type === 'NodeRenamed' ||
    type === 'NodeRemoved' ||
    type === 'NodeTypeChanged' ||
    type === 'NodeSchemaChanged' ||
    type === 'NodeExampleValuesChanged' ||
    type === 'NodesConnected' ||
    type === 'NodesDisconnected' ||
    type === 'ProjectAdded' ||
    type === 'ProjectRenamed' ||
    type === 'ChapterAdded' ||
    type === 'ChapterRenamed'
  );
}

function isEventPayload(type: DcbEvent['type'], payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  switch (type) {
    case 'NodeAdded':
      return (
        typeof candidate.projectId === 'string' &&
        typeof candidate.chapterId === 'string' &&
        typeof candidate.nodeId === 'string' &&
        isNodeType(candidate.type) &&
        typeof candidate.laneId === 'number' &&
        typeof candidate.label === 'string'
      );
    case 'NodeChapterChanged':
      return typeof candidate.projectId === 'string' && typeof candidate.nodeId === 'string' && typeof candidate.chapterId === 'string';
    case 'NodeRenamed':
      return typeof candidate.projectId === 'string' && typeof candidate.nodeId === 'string' && typeof candidate.newName === 'string';
    case 'NodeRemoved':
      return typeof candidate.projectId === 'string' && typeof candidate.nodeId === 'string';
    case 'NodeTypeChanged':
      return typeof candidate.projectId === 'string' && typeof candidate.nodeId === 'string' && isNodeType(candidate.newType);
    case 'NodeSchemaChanged':
      return (
        typeof candidate.projectId === 'string' &&
        typeof candidate.nodeId === 'string' &&
        Array.isArray(candidate.schema) &&
        candidate.schema.every(isNodePropertySchema)
      );
    case 'NodeExampleValuesChanged':
      return (
        typeof candidate.projectId === 'string' &&
        typeof candidate.nodeId === 'string' &&
        Array.isArray(candidate.exampleValues) &&
        candidate.exampleValues.every(isNodePropertyExampleValues)
      );
    case 'NodesConnected':
      return (
        typeof candidate.projectId === 'string' &&
        typeof candidate.sourceNodeId === 'string' &&
        typeof candidate.targetNodeId === 'string' &&
        (candidate.role === 'flow' || candidate.role === 'back-reference')
      );
    case 'NodesDisconnected':
      return (
        typeof candidate.projectId === 'string' && typeof candidate.sourceNodeId === 'string' && typeof candidate.targetNodeId === 'string'
      );
    case 'ProjectAdded':
      return typeof candidate.projectId === 'string' && typeof candidate.name === 'string';
    case 'ProjectRenamed':
      return typeof candidate.projectId === 'string' && typeof candidate.newName === 'string';
    case 'ChapterAdded':
      return typeof candidate.projectId === 'string' && typeof candidate.chapterId === 'string' && typeof candidate.title === 'string';
    case 'ChapterRenamed':
      return typeof candidate.projectId === 'string' && typeof candidate.chapterId === 'string' && typeof candidate.newTitle === 'string';
    default:
      return false;
  }
}

function isNodeType(type: unknown): type is NodeType {
  return type === 'ui' || type === 'cmd' || type === 'evt' || type === 'rm' || type === 'dm' || type === 'processor';
}

function isNodePropertySchema(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object') {
    return false;
  }

  const candidate = schema as Record<string, unknown>;
  return (
    typeof candidate.propertyId === 'string' &&
    typeof candidate.name === 'string' &&
    isPropertyType(candidate.type) &&
    (candidate.list === undefined || typeof candidate.list === 'boolean') &&
    (candidate.optional === undefined || typeof candidate.optional === 'boolean') &&
    (candidate.generated === undefined || typeof candidate.generated === 'boolean') &&
    (candidate.properties === undefined ||
      (candidate.type === 'Object' && Array.isArray(candidate.properties) && candidate.properties.every(isNodePropertySchema)))
  );
}

function isPropertyType(type: unknown): boolean {
  return type === 'string' || type === 'number' || type === 'boolean' || type === 'Object';
}

function isNodePropertyExampleValues(exampleValues: unknown): boolean {
  if (!exampleValues || typeof exampleValues !== 'object') {
    return false;
  }

  const candidate = exampleValues as Record<string, unknown>;
  return (
    typeof candidate.propertyId === 'string' &&
    (candidate.scalarValue === undefined || isNodeExamplePrimitive(candidate.scalarValue)) &&
    (candidate.scalarListValues === undefined ||
      (Array.isArray(candidate.scalarListValues) && candidate.scalarListValues.every(isNodeExamplePrimitive))) &&
    (candidate.complexValue === undefined || isNodeComplexExampleValue(candidate.complexValue)) &&
    (candidate.complexListValues === undefined ||
      (Array.isArray(candidate.complexListValues) && candidate.complexListValues.every(isNodeComplexExampleValue)))
  );
}

function isNodeExamplePrimitive(value: unknown): boolean {
  return typeof value === 'string' || value === null;
}

function isNodeComplexExampleValue(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((nestedValue) => isNodeExamplePrimitive(nestedValue) || isNodeComplexExampleValue(nestedValue));
}
