import type { VNode } from "preact";

export function renderToReadableStream(
  vnode: VNode
): ReadableStream<Uint8Array>;

export function createFromReadableStream(
  stream: ReadableStream<Uint8Array>
): Promise<VNode>;
