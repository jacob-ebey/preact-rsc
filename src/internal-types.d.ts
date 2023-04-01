import type { ComponentChildren } from "preact";
import type { Jsonifiable } from "type-fest";

export type RSCElementSymbol = "$";
export type RSCElementType = string | `@${number}` | `$${number}`;

export type EncodedRSCElement = [
  RSCElementSymbol,
  RSCElementType,
  RSCElement | null,
  { children?: RSCElement[] } | null
];

export type RSCElement = EncodedRSCElement | string | boolean | number | null;

export type RSCMetaChunkSymbol = "M";
export type RSCMetaChunk = `${RSCMetaChunkSymbol}${number}:${string}`;
export type RSCBuiltinChunkSymbol = "S";
export type RSCBuiltinChunk = `${RSCBuiltinChunkSymbol}${number}:${string}`;
export type RSCElementChunkSymbol = "J";
export type RSCElementChunk = `${RSCElementChunkSymbol}${number}:${string}`;

export type RSCChunkType =
  | RSCMetaChunkSymbol
  | RSCBuiltinChunkSymbol
  | RSCElementChunkSymbol;

export type RSCChunk = [RSCChunkType, number, Jsonifiable];

export interface RenderContext {
  enqueueChunk(chunk: RSCChunk): void;
  ensureBuiltin(name: string): number;
  enqueuePromise(promise: Promise<void>): void;
  nextId(): number;
  requestSuspense(): void;
  waitForSuspense<T>(
    maybeSuspend: (context: RenderContext) => Promise<T>
  ): Promise<[true, Promise<T>] | [false, Awaited<T>]>;
}
