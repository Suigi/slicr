import { describe, expect, it } from 'vitest';
import { getDependencySuggestions, getUsesKeySuggestions } from './dslAutocomplete';

describe('dsl autocomplete', () => {
  it('suggests existing node refs after a dependency arrow', () => {
    const dsl = `slice "Orders"

evt:order-created
rm:orders <- evt:order-created
cmd:create-order <- `;

    const suggestions = getDependencySuggestions(dsl, dsl.length);

    expect(suggestions).toContain('evt:order-created');
    expect(suggestions).toContain('rm:orders');
  });

  it('filters suggestions by typed dependency prefix', () => {
    const dsl = `slice "Orders"

evt:order-created
evt:order-cancelled
cmd:create-order <- evt:order-can`;

    const suggestions = getDependencySuggestions(dsl, dsl.length);

    expect(suggestions).toEqual(['evt:order-cancelled']);
  });

  it('does not suggest the target node itself as an incoming dependency', () => {
    const dsl = `slice "Orders"

evt:order-created <- `;

    const suggestions = getDependencySuggestions(dsl, dsl.length);

    expect(suggestions).not.toContain('evt:order-created');
  });

  it('suggests existing refs for inline forward arrows and excludes the source node', () => {
    const dsl = `slice "Rooms"

evt:room-booked
rm:available-rooms
evt:room-booked -> `;

    const suggestions = getDependencySuggestions(dsl, dsl.length);

    expect(suggestions).toContain('rm:available-rooms');
    expect(suggestions).not.toContain('evt:room-booked');
  });

  it('suggests existing refs for forward arrows on separate indented lines', () => {
    const dsl = `slice "Rooms"

evt:room-booked
rm:available-rooms
evt:room-booked
  -> `;

    const suggestions = getDependencySuggestions(dsl, dsl.length);

    expect(suggestions).toContain('rm:available-rooms');
    expect(suggestions).not.toContain('evt:room-booked');
  });

  it('supports dependency suggestions when node declarations include aliases', () => {
    const dsl = `slice "Aliases"

rm:my-rm "My Read Model"
ui:my-ui "My UI"
  <- `;

    const suggestions = getDependencySuggestions(dsl, dsl.length);

    expect(suggestions).toContain('rm:my-rm');
    expect(suggestions).not.toContain('ui:my-ui');
  });

  it('does not treat stream metadata lines as dependency refs', () => {
    const dsl = `slice "Streams"

evt:first-event
stream: first
rm:read-model <- `;

    const suggestions = getDependencySuggestions(dsl, dsl.length);

    expect(suggestions).toContain('evt:first-event');
    expect(suggestions).not.toContain('stream:first');
  });

  it('suggests unprefixed generic refs in dependency clauses', () => {
    const dsl = `slice "Generic"

checkout-screen
cmd:place-order <- `;

    const suggestions = getDependencySuggestions(dsl, dsl.length);

    expect(suggestions).toContain('checkout-screen');
    expect(suggestions).not.toContain('cmd:place-order');
  });

  it('suggests uses keys from predecessor and non-generic node data with .. trigger', () => {
    const dsl = `slice "Uses"

evt:seed
data:
  alpha: 1
  profile:
    city: "Berlin"

rm:view
<- evt:seed
uses:
  ..`;

    const result = getUsesKeySuggestions(dsl, dsl.length);
    const suggestions = result?.suggestions ?? [];
    expect(suggestions).toContain('alpha');
    expect(suggestions).toContain('profile.city');
  });

  it('ranks exact-prefix uses key matches first', () => {
    const dsl = `slice "Rank"

evt:seed
data:
  alpha: 1
  betaAlpha: 2

cmd:consume
<- evt:seed
uses:
  al..`;

    const result = getUsesKeySuggestions(dsl, dsl.length);
    expect(result?.suggestions[0]).toBe('alpha');
  });
});
