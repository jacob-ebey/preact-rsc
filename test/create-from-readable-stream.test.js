import * as assert from "node:assert";
import { it } from "node:test";

import { h } from "preact";
import { Suspense } from "preact/compat";
import { renderToReadableStream as renderToHTMLReadableStream } from "@jacob-ebey/preact-render-to-string/stream";

import {
  createFromReadableStream,
  renderToReadableStream,
} from "../src/index.js";

import { Deferred } from "../src/utils.js";

it("should render basic HTML", async () => {
  const stream = renderToReadableStream(h("div", null, "Hello world!"));
  const vnode = await createFromReadableStream(stream);
  const htmlStream = renderToHTMLReadableStream(vnode);
  const chunks = [];
  for await (const chunk of htmlStream) {
    chunks.push(chunk);
  }

  assert.equal(
    Buffer.concat(chunks).toString("utf-8"),
    `<div>Hello world!</div>`
  );
});

it("should render component", async () => {
  const stream = renderToReadableStream(h(Hello, { name: "world" }));
  const vnode = await createFromReadableStream(stream);
  const htmlStream = renderToHTMLReadableStream(vnode);
  const chunks = [];
  for await (const chunk of htmlStream) {
    chunks.push(chunk);
  }

  assert.equal(
    Buffer.concat(chunks).toString("utf-8"),
    `<div>Hello world!</div>`
  );
});

it("should render component inside elements", async () => {
  const stream = renderToReadableStream(
    h("div", { className: "outer" }, h(Hello, { name: "world" }))
  );
  const vnode = await createFromReadableStream(stream);
  const htmlStream = renderToHTMLReadableStream(vnode);
  const chunks = [];
  for await (const chunk of htmlStream) {
    chunks.push(chunk);
  }

  assert.equal(
    Buffer.concat(chunks).toString("utf-8"),
    `<div class="outer"><div>Hello world!</div></div>`
  );
});

it("should render elements inside components", async () => {
  const stream = renderToReadableStream(
    h(Wrapper, null, h("div", null, "Hello world!"))
  );
  const vnode = await createFromReadableStream(stream);
  const htmlStream = renderToHTMLReadableStream(vnode);
  const chunks = [];
  for await (const chunk of htmlStream) {
    chunks.push(chunk);
  }

  assert.equal(
    Buffer.concat(chunks).toString("utf-8"),
    `<div class="outer"><div>Hello world!</div></div>`
  );
});

it("should render nested components", async () => {
  const stream = renderToReadableStream(
    h(Wrapper, null, h(Hello, { name: "world" }))
  );
  const vnode = await createFromReadableStream(stream);
  const htmlStream = renderToHTMLReadableStream(vnode);
  const chunks = [];
  for await (const chunk of htmlStream) {
    chunks.push(chunk);
  }

  assert.equal(
    Buffer.concat(chunks).toString("utf-8"),
    `<div class="outer"><div>Hello world!</div></div>`
  );
});

it("should render async components", async () => {
  const stream = renderToReadableStream(
    h(AsyncHello, { name: Promise.resolve("world") })
  );
  const vnode = await createFromReadableStream(stream);
  const htmlStream = renderToHTMLReadableStream(vnode);
  const chunks = [];
  for await (const chunk of htmlStream) {
    chunks.push(chunk);
  }

  assert.equal(
    Buffer.concat(chunks).toString("utf-8"),
    `<div>Hello world!</div>`
  );
});

it("should render async component inside element", async () => {
  const stream = renderToReadableStream(
    h(
      "div",
      { className: "outer" },
      h(AsyncHello, { name: Promise.resolve("world") })
    )
  );
  const vnode = await createFromReadableStream(stream);
  const htmlStream = renderToHTMLReadableStream(vnode);
  const chunks = [];
  for await (const chunk of htmlStream) {
    chunks.push(chunk);
  }

  assert.equal(
    Buffer.concat(chunks).toString("utf-8"),
    `<div class="outer"><div>Hello world!</div></div>`
  );
});

it("should render async component inside component", async () => {
  const stream = renderToReadableStream(
    h(Wrapper, null, h(AsyncHello, { name: Promise.resolve("world") }))
  );
  const vnode = await createFromReadableStream(stream);
  const htmlStream = renderToHTMLReadableStream(vnode);
  const chunks = [];
  for await (const chunk of htmlStream) {
    chunks.push(chunk);
  }

  assert.equal(
    Buffer.concat(chunks).toString("utf-8"),
    `<div class="outer"><div>Hello world!</div></div>`
  );
});

it("should render suspense without hole", async () => {
  const stream = renderToReadableStream(
    h(Suspense, { fallback: "Loading..." }, h(Hello, { name: "world" }))
  );
  const vnode = await createFromReadableStream(stream);
  const htmlStream = renderToHTMLReadableStream(vnode);
  const chunks = [];
  for await (const chunk of htmlStream) {
    chunks.push(Buffer.from(chunk).toString("utf-8"));
  }

  assert.deepEqual(chunks, [`<div>Hello world!</div>`]);
});

it("should render suspense with hole for async component", async () => {
  const nameDeferred = new Deferred();
  const stream = renderToReadableStream(
    h(
      Suspense,
      { fallback: h("div", {}, "Loading...") },
      h(AsyncHello, { name: nameDeferred.promise })
    )
  );
  const vnode = await createFromReadableStream(stream);
  const htmlStream = renderToHTMLReadableStream(vnode);
  nameDeferred.resolve("world");
  const chunks = [];
  for await (const chunk of htmlStream) {
    chunks.push(Buffer.from(chunk).toString("utf-8"));
  }

  assert.equal(
    `<!--preact-island:58--><div>Loading...</div><!--/preact-island:58-->`,
    chunks[0]
  );
  assert.equal(chunks[1], `<div hidden>`);
  assert.equal(
    chunks[2].startsWith("<script>") && chunks[2].endsWith("</script>"),
    true
  );
  assert.equal(
    chunks[3],
    `<preact-island hidden data-target="58"><div>Hello world!</div></preact-island>`
  );
  assert.equal(chunks[4], `</div>`);
});

it("should render hole for client component", async () => {
  const stream = renderToReadableStream(
    h(Client, null, h(Hello, { name: "world" })),
    {
      getClientReferenceData,
    }
  );
  const vnode = await createFromReadableStream(stream, {
    getClientReference(data) {
      return Client;
    },
  });
  const htmlStream = renderToHTMLReadableStream(vnode);
  const chunks = [];
  for await (const chunk of htmlStream) {
    chunks.push(Buffer.from(chunk).toString("utf-8"));
  }

  assert.deepEqual(chunks, [
    `<div class="client"><div>Hello world!</div></div>`,
  ]);
});

function Hello({ name }) {
  return h("div", null, `Hello ${name}!`);
}

function Wrapper({ children }) {
  return h("div", { className: "outer" }, children);
}

async function AsyncHello({ name }) {
  return h("div", null, `Hello ${await name}!`);
}

function Client({ children }) {
  return h("div", { className: "client" }, children);
}
Object.defineProperties(Client, {
  $$typeof: { value: Symbol.for("preact.reference.client") },
  $$id: { value: "Client" },
});

function getClientReferenceData(id) {
  switch (id) {
    case "Client":
      return { id: "/client.js", name: "Client" };
    default:
      throw new Error(`Unknown client reference: ${id}`);
  }
}
