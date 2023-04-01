// @jsx h
import "preact/debug";

import { h, hydrate } from "preact";
import { Suspense } from "preact/compat";
import { createFromReadableStream } from "../src/index.js";

run();

async function run() {
  // const response = await fetch("/_rsc");
  // const rscChunk = await createFromReadableStream(response.body, {
  const rscChunk = await createFromReadableStream(window.__rscStream, {
    async getClientReference({ id, name }) {
      const mod = await import(id);
      return mod[name];
    },
  });
  console.log(rscChunk);
  hydrate(<Suspense>{rscChunk}</Suspense>, document.getElementById("app"));
}
