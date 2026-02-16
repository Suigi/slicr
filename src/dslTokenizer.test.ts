import { describe, expect, it } from 'vitest';
import { DEFAULT_DSL } from './defaultDsl';
import { DslTokenType, readDslToken, tokenizeDslLine } from './dslTokenizer';

type EmittedToken = {
  text: string;
  type: DslTokenType | null;
};

class MockStream {
  readonly input: string;
  pos = 0;

  constructor(input: string) {
    this.input = input;
  }

  sol() {
    return this.pos === 0;
  }

  eol() {
    return this.pos >= this.input.length;
  }

  eatSpace() {
    const start = this.pos;
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos += 1;
    }
    return this.pos - start;
  }

  match(pattern: RegExp | string) {
    const rest = this.input.slice(this.pos);
    if (typeof pattern === 'string') {
      if (!rest.startsWith(pattern)) {
        return null;
      }
      this.pos += pattern.length;
      return pattern;
    }

    const anchored = new RegExp(`^(?:${pattern.source})`, pattern.flags);
    const result = rest.match(anchored);
    if (!result) {
      return null;
    }
    this.pos += result[0].length;
    return result;
  }

  next() {
    if (this.eol()) {
      return undefined;
    }
    const value = this.input[this.pos];
    this.pos += 1;
    return value;
  }
}

function tokenizeLine(line: string): EmittedToken[] {
  const stream = new MockStream(line);
  const tokens: EmittedToken[] = [];

  while (!stream.eol()) {
    const start = stream.pos;
    const type = readDslToken(stream);
    if (stream.pos <= start) {
      throw new Error(`Tokenizer did not advance on "${line}" at ${start}`);
    }
    tokens.push({ text: line.slice(start, stream.pos), type });
  }

  return tokens;
}

function tokenizeDsl(src: string): EmittedToken[] {
  return src.split('\n').flatMap((line) => tokenizeLine(line).filter((token) => token.type !== null));
}

describe('DSL tokenizer', () => {
  it('recognizes event modeling keywords in default DSL', () => {
    const tokens = tokenizeDsl(DEFAULT_DSL);
    const counts = tokens.reduce<Record<string, number>>((acc, token) => {
      if (token.type) {
        acc[token.type] = (acc[token.type] ?? 0) + 1;
      }
      return acc;
    }, {});

    expect(counts.rmType).toBe(3);
    expect(counts.uiType).toBe(2);
    expect(counts.cmdType).toBe(1);
    expect(counts.evtType).toBe(2);
  });

  it('recognizes structural DSL tokens and JSON values', () => {
    const tokens = tokenizeDsl(DEFAULT_DSL);

    expect(tokens.some((token) => token.type === 'keyword' && token.text.trim() === 'slice')).toBe(true);
    expect(tokens.some((token) => token.type === 'keyword' && token.text.trim() === 'data')).toBe(true);
    expect(tokens.some((token) => token.type === 'operator' && token.text.trim() === '->')).toBe(true);
    expect(tokens.some((token) => token.type === 'number' && token.text === '101')).toBe(true);
    expect(tokens.some((token) => token.type === 'string' && token.text === '"Book Room"')).toBe(true);
    expect(tokens.some((token) => token.type === 'string' && token.text === '"pending"')).toBe(true);
  });

  it('tokenizes simple command-event-readmodel flow line by line', () => {
    const cmdTokens = tokenizeDslLine('  cmd:the-command');
    const evtTokens = tokenizeDslLine('  -> evt:the-event');
    const rmTokens = tokenizeDslLine('    -> rm:the-read-model');

    expect(cmdTokens.map((token) => token.type)).toEqual(['cmdType', 'punctuation', 'variableName']);
    expect(evtTokens.map((token) => token.type)).toEqual(['operator', 'evtType', 'punctuation', 'variableName']);
    expect(rmTokens.map((token) => token.type)).toEqual(['operator', 'rmType', 'punctuation', 'variableName']);
  });

  it('tokenizes JSON arrays in data blocks as attribute names', () => {
    const tokens = tokenizeDslLine('  data: {"ids": [1, 2, 3]}');
    const tokenTypes = tokens.map((token) => token.type);

    expect(tokenTypes).not.toContain('attributeName');
    expect(tokenTypes.filter((type) => type === 'number')).toHaveLength(3);
    expect(tokenTypes.filter((type) => type === 'punctuation').length).toBeGreaterThanOrEqual(6);
  });
});
