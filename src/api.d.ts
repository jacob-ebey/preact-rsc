import type { ComponentType, VNode } from "preact";
import type { Jsonifiable } from "type-fest";

export interface RenderToReadableStreamOptions {
  getClientReferenceData?(id): Jsonifiable;
}

export function renderToReadableStream(
  vnode: VNode,
  options?: RenderToReadableStreamOptions
): ReadableStream<Uint8Array>;

export interface CreateFromReadableStreamOptions {
  getClientReference(data: unknown): Promise<ComponentType>;
}

export function createFromReadableStream(
  stream: ReadableStream<Uint8Array>,
  options?: CreateFromReadableStreamOptions
): Promise<VNode>;
