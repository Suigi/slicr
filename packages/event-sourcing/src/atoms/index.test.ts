import {describe, expect, it} from 'vitest';
import {bindAtom, type Atom} from './index';
import {Query} from '../query';
import type {Event} from '../types';

type TestEvent = Event<'ThingAdded', { thingId: string }>;

describe('bindAtom', () => {
  const thingExists: Atom<TestEvent, { thingId: string }, boolean> = {
    query: ({thingId}) => Query.where({types: ['ThingAdded'], tags: [`thingId:${thingId}`]}),
    project: ({thingId}, events) => events.some(event => event.payload.thingId === thingId),
  };

  it('binds atom query and projection to a command scope', () => {
    const boundAtom = bindAtom(
      thingExists,
      (command: { data: { thingId: string } }) => ({thingId: command.data.thingId}),
    );
    const command = {data: {thingId: 'thing-id'}};

    expect(boundAtom.query(command))
      .toEqual(Query.where({types: ['ThingAdded'], tags: ['thingId:thing-id']}));
    expect(boundAtom.project(command, [
      {type: 'ThingAdded', payload: {thingId: 'thing-id'}, tags: ['thingId:thing-id']}
    ]))
      .toEqual(true);
  });
});
