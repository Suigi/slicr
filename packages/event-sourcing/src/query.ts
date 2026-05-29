import type {EventType, Tag} from './types.ts';

export type SequencePosition = number;

export type Query =
  | { readonly kind: 'none' }
  | { readonly kind: 'all' }
  | { readonly kind: 'items'; readonly items: readonly QueryItem[] };

export type QueryItem = Readonly<{
  /** Matches when an event's type is one of these values. */
  types?: readonly EventType[];
  /** Matches when an event contains all of these tags. */
  tags?: readonly Tag[];
}>;

export const Query = {
  all: (): Query => ({kind: 'all'}),

  none: (): Query => ({kind: 'none'}),

  where: (item: QueryItem): Query => ({
    kind: 'items',
    items: [item],
  }),

  anyOf: (...items: readonly QueryItem[]): Query => ({
    kind: 'items',
    items,
  }),
};
