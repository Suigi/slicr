import {describe, expect, it} from 'vitest';
import {Query} from './query.ts';
import {
  AppendConditionFailedError,
  type AppendCondition,
  type ReadOptions,
  type SequencePosition,
  type SequencedEvent,
  type SpecEventStore,
} from './index.ts';
import type {Event} from './types.ts';

type TestEvent = Event<'Created', {readonly value: number}>;

const testEvent: TestEvent = {type: 'Created', payload: {value: 1}, tags: []};

const testSequencedEvent: SequencedEvent<TestEvent> = {position: 1, event: testEvent};
const testReadOptions: ReadOptions = {from: 1};
const testAppendCondition: AppendCondition = {failIfEventsMatch: Query.all(), after: 1};

describe('SpecEventStore public contract', () => {
  it('is importable and models async read/query/conditional append', async () => {
    const position: SequencePosition = 1;
    expect(position).toBe(1);

    const store: SpecEventStore<TestEvent> = {
      async read(options = testReadOptions) {
        expect(options).toEqual(testReadOptions);
        return [testSequencedEvent];
      },
      async query(query, options = testReadOptions) {
        expect(query).toEqual(Query.all());
        expect(options).toEqual(testReadOptions);
        return [testSequencedEvent];
      },
      async append(events, condition = testAppendCondition) {
        expect(events).toEqual([testEvent]);
        expect(condition).toEqual(testAppendCondition);
        return [testSequencedEvent];
      },
    };

    await expect(store.read(testReadOptions)).resolves.toEqual([testSequencedEvent]);
    await expect(store.query(Query.all(), testReadOptions)).resolves.toEqual([testSequencedEvent]);
    await expect(store.append([testEvent], testAppendCondition)).resolves.toEqual([testSequencedEvent]);
  });

  it('exposes failed condition and conflicting sequenced events on append-condition errors', () => {
    const conflictingEvents: readonly SequencedEvent<TestEvent>[] = [
      {position: 7, event: testEvent},
    ];
    const error = new AppendConditionFailedError(testAppendCondition, conflictingEvents);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppendConditionFailedError);
    expect(error.name).toBe('AppendConditionFailedError');
    expect(error.message).toBe('Append condition failed');
    expect(error.condition).toBe(testAppendCondition);
    expect(error.conflictingEvents).toBe(conflictingEvents);
  });
});
