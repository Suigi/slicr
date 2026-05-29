import {Query} from './query';

export type EventType = string;
export type Tag = string;

export interface Event<Type = string, Payload = unknown> {
  readonly type: Type;
  readonly payload: Payload;
  readonly tags: Tag[];
}

export interface Store<E extends Event> {
  append(events: E | E[]): void;

  query(query: Query): E[];
}
