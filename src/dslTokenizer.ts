export type DslTokenType =
  | 'keyword'
  | 'rmType'
  | 'uiType'
  | 'cmdType'
  | 'evtType'
  | 'typeName'
  | 'punctuation'
  | 'attributeName'
  | 'string'
  | 'bool'
  | 'null'
  | 'number'
  | 'operator'
  | 'variableName';

export type DslToken = {
  from: number;
  to: number;
  type: DslTokenType;
};

export type TokenStream = {
  sol: () => boolean;
  eatSpace: () => boolean | number | undefined;
  match: (pattern: RegExp | string) => unknown;
  next: () => string | void;
};

export function readDslToken(stream: TokenStream): DslTokenType | null {
  if (stream.sol()) {
    stream.eatSpace();
  }

  if (stream.match(/->/)) {
    return 'operator';
  }

  if (stream.match(/slice\b/)) {
    return 'keyword';
  }

  if (stream.match(/data(?=:)/)) {
    return 'keyword';
  }

  if (stream.match(/rm(?=:)/)) {
    return 'rmType';
  }

  if (stream.match(/ui(?=:)/)) {
    return 'uiType';
  }

  if (stream.match(/cmd(?=:)/)) {
    return 'cmdType';
  }

  if (stream.match(/evt(?=:)/)) {
    return 'evtType';
  }

  if (stream.match(/[a-z]+(?=:)/)) {
    return 'typeName';
  }

  if (stream.match(/:[ \t]*/)) {
    return 'punctuation';
  }

  if (stream.match(/\[[A-Za-z][A-Za-z0-9 _.-]*]/)) {
    return 'attributeName';
  }

  if (stream.match(/"(?:[^"\\]|\\.)*"/)) {
    return 'string';
  }

  if (stream.match(/\b(?:true|false)\b/)) {
    return 'bool';
  }

  if (stream.match(/\bnull\b/)) {
    return 'null';
  }

  if (stream.match(/-?\d+(?:\.\d+)?/)) {
    return 'number';
  }

  if (stream.match(/[{}\[\],]/)) {
    return 'punctuation';
  }

  if (stream.match(/[A-Za-z0-9_.-]+/)) {
    return 'variableName';
  }

  stream.next();
  return null;
}

class LineStream implements TokenStream {
  private readonly input: string;
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
    while (this.pos < this.input.length && /[\s\u00a0]/.test(this.input[this.pos])) {
      this.pos += 1;
    }
    return this.pos > start;
  }

  match(pattern: RegExp | string) {
    const rest = this.input.slice(this.pos);

    if (typeof pattern === 'string') {
      if (!rest.startsWith(pattern)) {
        return null;
      }
      this.pos += pattern.length;
      return true;
    }

    const result = rest.match(pattern);
    if (!result || result.index !== 0) {
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

export function tokenizeDslLine(line: string): DslToken[] {
  const stream = new LineStream(line);
  const tokens: DslToken[] = [];

  while (!stream.eol()) {
    const from = stream.pos;
    const type = readDslToken(stream);
    const to = stream.pos;

    if (to <= from) {
      throw new Error(`Tokenizer did not advance at ${from} for line "${line}"`);
    }

    if (type) {
      tokens.push({ from, to, type });
    }
  }

  return tokens;
}
