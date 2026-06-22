import {
  AppendConditionFailedError,
  bindAtom,
  combineAtoms as combineGenericAtoms,
  handleCommand,
  Handler,
  IndexedDBEventStore,
  IndexedDBSpecEventStore,
  MemorySpecEventStore,
  MemoryStore,
  Query,
} from '@slicr/event-sourcing';
import type {
  AnyCommand,
  AppendCondition,
  Atom,
  Command,
  Decider,
  Event,
  ReadOptions,
  SequencedEvent,
  SomeCommand,
  SpecEventStore,
  Store,
} from '@slicr/event-sourcing';
import type {DcbEvent as AppDcbEvent} from './events';

export type DcbEvent = AppDcbEvent;

export type DcbCommand<Type extends string, Data extends Record<string, unknown> = Record<string, unknown>> = Command<Type, Data>;
export type DcbAnyCommand = AnyCommand;
export type DcbSomeCommand<Data extends Record<string, unknown>> = SomeCommand<Data>;
export type DcbStore = Store<DcbEvent>;
export type DcbSpecStore = SpecEventStore<DcbEvent>;
export type DcbAtom<Scope, Model> = Atom<DcbEvent, Scope, Model>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DcbAnyAtom = DcbAtom<any, any>;
export type DcbDecider<CommandType, DecisionModel> = Decider<CommandType, DcbEvent, DecisionModel>;
export type DcbSequencedEvent = SequencedEvent<DcbEvent>;
export type DcbAppendCondition = AppendCondition;
export type DcbReadOptions = ReadOptions;

export const combineAtoms = <AtomsToCombine extends Record<string, DcbAnyAtom>>(
  atoms: AtomsToCombine,
) => combineGenericAtoms(atoms);

export {AppendConditionFailedError, Query, MemoryStore, MemorySpecEventStore, IndexedDBEventStore, IndexedDBSpecEventStore, bindAtom, handleCommand, Handler};
export type {AnyCommand, AppendCondition, Atom, Command, Decider, Event, ReadOptions, SequencedEvent, SomeCommand, SpecEventStore, Store};
