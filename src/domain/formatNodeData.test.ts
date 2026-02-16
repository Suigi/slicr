import { describe, expect, it } from 'vitest';
import { countNodeDataLines, formatNodeData } from './formatNodeData';

describe('formatNodeData', () => {
  it('formats arrays of objects as YAML-like blocks', () => {
    const data = {
      rooms: [
        { 'room-number': 101, capacity: 2 },
        { 'room-number': 102, capacity: 4 }
      ]
    };

    const formatted = formatNodeData(data);
    expect(formatted).toHaveLength(1);
    expect(formatted[0].text).toBe(
      `rooms:
  - room-number: 101
    capacity: 2
  - room-number: 102
    capacity: 4`
    );
    expect(countNodeDataLines(data)).toBe(5);
  });
});
