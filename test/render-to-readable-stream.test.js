import * as assert from "node:assert";
import { it } from "node:test";

import { h } from "preact";
import { Suspense } from "preact/compat";

import { renderToReadableStream } from "../src/index.js";

it("should render basic HTML", async () => {
  const stream = renderToReadableStream(h("div", null, "Hello world!"));
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  assert.equal(
    Buffer.concat(chunks).toString("utf-8"),
    `J0:["$","div",null,{"children":["Hello world!"]}]\n`
  );
});

it("should render component", async () => {
  const stream = renderToReadableStream(h(Hello, { name: "world" }));
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  assert.equal(
    Buffer.concat(chunks).toString("utf-8"),
    `J0:["$","div",null,{"children":["Hello world!"]}]\n`
  );
});

it("should render component inside elements", async () => {
  const stream = renderToReadableStream(
    h("div", { className: "outer" }, h(Hello, { name: "world" }))
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  assert.equal(
    Buffer.concat(chunks).toString("utf-8"),
    `J0:["$","div",null,{"class":"outer","children":[["$","div",null,{"children":["Hello world!"]}]]}]\n`
  );
});

it("should render elements inside components", async () => {
  const stream = renderToReadableStream(
    h(Wrapper, null, h("div", null, "Hello world!"))
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  assert.equal(
    Buffer.concat(chunks).toString("utf-8"),
    `J0:["$","div",null,{"class":"outer","children":[["$","div",null,{"children":["Hello world!"]}]]}]\n`
  );
});

it("should render nested components", async () => {
  const stream = renderToReadableStream(
    h(Wrapper, null, h(Hello, { name: "world" }))
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  assert.equal(
    Buffer.concat(chunks).toString("utf-8"),
    `J0:["$","div",null,{"class":"outer","children":[["$","div",null,{"children":["Hello world!"]}]]}]\n`
  );
});

it("should render async components", async () => {
  const stream = renderToReadableStream(
    h(AsyncHello, { name: Promise.resolve("world") })
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  assert.equal(
    Buffer.concat(chunks).toString("utf-8"),
    `J0:["$","div",null,{"children":["Hello world!"]}]\n`
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
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  assert.equal(
    Buffer.concat(chunks).toString("utf-8"),
    `J0:["$","div",null,{"class":"outer","children":[["$","div",null,{"children":["Hello world!"]}]]}]\n`
  );
});

it("should render async component inside component", async () => {
  const stream = renderToReadableStream(
    h(Wrapper, null, h(AsyncHello, { name: Promise.resolve("world") }))
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  assert.equal(
    Buffer.concat(chunks).toString("utf-8"),
    `J0:["$","div",null,{"class":"outer","children":[["$","div",null,{"children":["Hello world!"]}]]}]\n`
  );
});

it("should render suspense without hole", async () => {
  const stream = renderToReadableStream(
    h(Suspense, { fallback: "Loading..." }, h(Hello, { name: "world" }))
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk).toString("utf-8"));
  }

  assert.deepEqual(chunks, [
    `S2:"Suspense"\n`,
    `S3:"Fragment"\n`,
    `J0:["$","$2",["$","$3",null,{"children":["Loading..."]}],{"children":[["$","div",null,{"children":["Hello world!"]}]]}]\n`,
  ]);
});

it("should render suspense with hole", async () => {
  const stream = renderToReadableStream(
    h(
      Suspense,
      { fallback: "Loading..." },
      h(AsyncHello, { name: Promise.resolve("world") })
    )
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk).toString("utf-8"));
  }

  assert.deepEqual(chunks, [
    `S2:"Suspense"\n`,
    `S3:"Fragment"\n`,
    `J0:["$","$2",["$","$3",null,{"children":["Loading..."]}],{"children":[["$","@1",null,{}]]}]\n`,
    `J1:["$","$3",null,{"children":[["$","div",null,{"children":["Hello world!"]}]]}]\n`,
  ]);
});

it("should render hole for client component", async () => {
  const stream = renderToReadableStream(
    h(Client, null, h(Hello, { name: "world" })),
    {
      getClientReferenceData,
    }
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk).toString("utf-8"));
  }

  assert.deepEqual(chunks, [
    `M1:{"id":"/client.js","name":"Client"}\n`,
    `J0:["$","@1",null,{"children":[["$","div",null,{"children":["Hello world!"]}]]}]\n`,
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
  $$typeof: { value: Symbol.for("preact.client.reference") },
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
