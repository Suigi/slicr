import { describe, expect, it } from 'vitest';
import { getDependencySuggestions } from './dslAutocomplete';

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
});
