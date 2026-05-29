import {describe, expect, it} from 'vitest';
import {MemoryStore} from './memoryStore';
import type {Event, Tag} from '../types';
import {Query} from '../query.ts';

describe('MemoryStore', () => {

    it('new store has no events', () => {
        const store = MemoryStore.create();
        expect(store.query(Query.all()))
            .toEqual([]);
    });

    it('appended event is stored', () => {
        const store = MemoryStore.create();
        const commandNodeAddedEvent = makeEvent(
            'NodeAdded',
            {type: 'Command', title: 'Command Title'});

        store.append(commandNodeAddedEvent);

        expect(store.query(Query.all()))
            .toEqual([commandNodeAddedEvent]);
    });

    it('events query returns copy', () => {
        const store = MemoryStore.create();
        const someEvent = makeEvent('SomeEvent');
        store.append(someEvent);

        const events = store.query(Query.all());
        events.push(makeEvent('AnotherEvent'));

        expect(store.query(Query.all()))
            .toEqual([someEvent]);
    });

    it('query by type and tag returns matching events', () => {
        const store = MemoryStore.create();
        const firstCommandAddedEvent = makeEvent(
            'NodeAdded',
            {type: 'Command', title: 'Command Title'},
            'nodeType:Command');
        const eventAddedEvent = makeEvent(
            'NodeAdded',
            {type: 'Event', title: 'Event Title'},
            'nodeType:Event');
        const secondCommandAddedEvent = makeEvent(
            'NodeAdded',
            {type: 'Command', title: 'Command Title'},
            'nodeType:Command');
        const readModelAddedEvent = makeEvent(
            'NodeAdded',
            {type: 'ReadModel', title: 'Read Model Title'},
            'nodeType:ReadModel');
        store.append([
            firstCommandAddedEvent,
            eventAddedEvent,
            secondCommandAddedEvent,
            readModelAddedEvent
        ]);

        const queryResult = store.query(Query.where({
            types: ['NodeAdded'],
            tags: ['nodeType:Command']
        }));

        expect(queryResult)
            .toEqual([
                firstCommandAddedEvent,
                secondCommandAddedEvent
            ]);
    });

    it('query items are connected with OR', () => {
        const store = MemoryStore.create();
        const commandNodeAddedEvent = makeEvent(
            'NodeAdded',
            {type: 'Command', title: 'Command Title'},
            'nodeType:Command');
        const eventNodeAddedEvent = makeEvent(
            'NodeAdded',
            {type: 'Event', title: 'Event Title'},
            'nodeType:Event');
        const readModelNodeAddedEvent = makeEvent(
            'NodeAdded',
            {type: 'ReadModel', title: 'Read Model Title'},
            'nodeType:ReadModel');

        store.append([
            commandNodeAddedEvent,
            eventNodeAddedEvent,
            readModelNodeAddedEvent,
        ]);

        const queryResult = store.query(Query.anyOf(
            {tags: ['nodeType:Command']},
            {tags: ['nodeType:Event']},
        ));

        expect(queryResult)
            .toEqual([
                commandNodeAddedEvent,
                eventNodeAddedEvent,
            ]);
    });

    it('query item tags are connected with AND', () => {
        const store = MemoryStore.create();
        const queriedMovie = 'movieId:m_29';
        const otherMovie = 'movieId:m_42';
        const categoryA = 'categoryId:cat_A';
        const categoryB = 'categoryId:cat_B';
        const categoryAReserved = makeEvent(
            'SeatReserved', {}, queriedMovie, categoryA);
        const categoryBReserved = makeEvent(
            'SeatReserved', {}, queriedMovie, categoryB);
        const otherMovieReserved = makeEvent(
            'SeatReserved', {}, otherMovie, categoryA);
        store.append([categoryAReserved, categoryBReserved, otherMovieReserved]);

        const queryResult = store.query(Query.where(
            {tags: [queriedMovie, categoryA]}));

        expect(queryResult).toEqual([categoryAReserved]);
    });

    const makeEvent = (type: string, payload?: unknown, ...tags: Tag[]): Event => {
        return {
            type,
            payload: payload ?? {empty: ''},
            tags: tags ?? [],
        };
    };
});