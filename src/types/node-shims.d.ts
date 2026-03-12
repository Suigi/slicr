declare module "node:crypto" {
  export function randomUUID(): string;
}

declare module "node:fs/promises" {
  export function writeFile(path: string, data: Uint8Array): Promise<void>;
  export function rm(path: string, options?: { force?: boolean }): Promise<void>;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare module "node:path" {
  export function join(...parts: string[]): string;
}

declare module "node:child_process" {
  type CloseListener = (code: number | null) => void;
  type ErrorListener = (error: unknown) => void;

  interface ChildProcessLike {
    once(event: "error", listener: ErrorListener): void;
    once(event: "close", listener: CloseListener): void;
  }

  export function spawn(
    command: string,
    args?: readonly string[],
    options?: {
      stdio?: "ignore";
      windowsHide?: boolean;
    },
  ): ChildProcessLike;
}

declare const process: {
  platform: string;
  stdout: {
    write(chunk: string): boolean;
  };
};
