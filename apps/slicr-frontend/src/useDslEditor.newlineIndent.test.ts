import { describe, expect, it } from 'vitest';
import { getNewLineIndent } from './useDslEditor';

describe('newline indentation', () => {
  it('keeps the same indentation as the previous line', () => {
    expect(getNewLineIndent('    rm:orders')).toBe('    ');
    expect(getNewLineIndent('  cmd:create-order <- ui:orders')).toBe('  ');
  });

  it('increases indentation by one level when previous line ends with a colon', () => {
    expect(getNewLineIndent('  data:')).toBe('    ');
    expect(getNewLineIndent('    rooms:')).toBe('      ');
  });

  it('does not increase indentation for colons that are not at line end', () => {
    expect(getNewLineIndent('  room-id: 42')).toBe('  ');
  });
});
