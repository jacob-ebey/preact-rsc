// @jsx h
import * as http from "node:http";
import * as path from "node:path";
import * as stream from "node:stream";
import * as url from "node:url";

import * as esbuild from "esbuild";

import { h } from "preact";
import { Suspense } from "preact/compat";
import { renderToReadableStream } from "@jacob-ebey/preact-render-to-string/stream";
import * as RSC from "../src/index.js";
import { Deferred } from "../src/utils.js";

import { App } from "./app.jsx";

const __filename = url.fileURLToPath(new URL(import.meta.url));
const __dirname = path.dirname(__filename);

const buildResult = await esbuild.build({
  bundle: true,
  entryPoints: [
    path.resolve(__dirname, "entry.browser.jsx"),
    path.resolve(__dirname, "client-components.jsx"),
  ],
  format: "esm",
  jsx: "transform",
  jsxFactory: "h",
  jsxFragment: "Fragment",
  outdir: __dirname,
  platform: "browser",
  publicPath: "/",
  splitting: true,
  target: "es2020",
  write: false,
});

const builtFiles = new Map(
  buildResult.outputFiles.map((outFile) => [
    "/" + path.relative(__dirname, outFile.path),
    outFile.text,
  ])
);

const server = http.createServer(async (req, res) => {
  const url = new URL(
    req.url,
    (req.headers["host"] && "http://" + req.headers["host"]) ||
      "http://localhost"
  );

  if (url.pathname === "/_rsc") {
    const rscStream = await RSC.renderToReadableStream(h(App, {}), {
      getClientReferenceData(id) {
        return { id: "/client-components.js", name: id };
      },
    });

    res.setHeader("content-type", "text/x-component");
    res.flushHeaders();
    for await (const chunk of rscStream) {
      res.write(chunk);
    }
    res.end();
    return;
  }

  if (builtFiles.has(url.pathname)) {
    res.setHeader("content-type", "text/javascript");
    res.end(builtFiles.get(url.pathname));
    return;
  }

  if (url.pathname === "/") {
    const rscStream = await RSC.renderToReadableStream(h(App, {}), {
      getClientReferenceData(id) {
        return { id: "/client-components.js", name: id };
      },
    });

    const teedRSCStream = rscStream.tee();

    const rscTransform = new RSCTransform(teedRSCStream[0]);
    const rscChunk = await RSC.createFromReadableStream(teedRSCStream[1], {
      async getClientReference({ id, name }) {
        const mod = await import(`.${id}x`);
        return mod[name];
      },
    });

    const js = String.raw;
    /** @type {ReadableStream} */
    const htmlStream = renderToReadableStream(
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Integration Test</title>
        </head>
        <body>
          <script
            dangerouslySetInnerHTML={{
              __html: js`
window.__rscEncoder = new TextEncoder();
window.__rscStream = new ReadableStream({
  start(controller) {
    window.__rscController = controller;
  }
});
            `,
            }}
          />
          <div id="app">
            <Suspense>{rscChunk}</Suspense>
          </div>
          {/* TODO: Debug async script hydration issues. Potentially fixed by https://github.com/preactjs/preact/pull/3957 */}
          <script type="module" src="/entry.browser.js" />
        </body>
      </html>
    );

    htmlStream.pipeTo(rscTransform.writable);

    res.setHeader("content-type", "text/html");
    res.flushHeaders();
    for await (const chunk of rscTransform.readable) {
      res.write(chunk);
    }
    res.end();
    return;
  }

  res.statusCode = 404;
  res.end();
});

server.listen(3000, () => {
  console.log("Running on http://localhost:3000/");
});

class RSCTransform extends TransformStream {
  /**
   * @param {ReadableStream<Uint8Array>} rscStream
   */
  constructor(rscStream) {
    super({
      start(controller) {
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        const queuedRSCChunks = [];
        this.deferred = new Deferred();

        this.flushRSCChunks = (close = false) => {
          while (queuedRSCChunks.length) {
            controller.enqueue(queuedRSCChunks.shift());
          }
          if (close) {
            controller.enqueue(
              encoder.encode(`<script>
  window.__rscController.close();
</script>`)
            );
          }
        };

        (async () => {
          for await (const chunk of rscStream) {
            const rscChunk = decoder.decode(chunk, { stream: true });
            if (rscChunk) {
              queuedRSCChunks.push(
                encoder.encode(`<script>
  window.__rscController.enqueue(window.__rscEncoder.encode(${JSON.stringify(
    rscChunk
  )}));
</script>`)
              );
            }
          }
          this.deferred.resolve();
        })();
      },
      async transform(chunk, controller) {
        controller.enqueue(chunk);
        this.flushRSCChunks();
      },
      async flush() {
        await this.deferred.promise;
        this.flushRSCChunks(true);
      },
    });
  }
}
