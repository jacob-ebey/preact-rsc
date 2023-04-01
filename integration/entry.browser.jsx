import "preact/debug";

import { render } from "preact";
import { Suspense } from "preact/compat";
import { createFromReadableStream } from "../src/index.js";

run();

async function run() {
  const response = await fetch("/_rsc");
  const rscChunk = await createFromReadableStream(response.body, {
    async getClientReference({ id, name }) {
      const mod = await import(id);
      return mod[name];
    },
  });
  console.log(rscChunk);
  render(<Suspense>{rscChunk}</Suspense>, document.getElementById("app"));
}
