import * as http from "node:http";
import * as path from "node:path";
import * as url from "node:url";

import * as esbuild from "esbuild";

import { h } from "preact";
import { renderToReadableStream } from "../src/index.js";

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
  jsx: "automatic",
  jsxImportSource: "preact",
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
    const rscStream = await renderToReadableStream(h(App, {}), {
      getClientReferenceData(id) {
        return { id: "/client-components.js", name: id };
      },
    });

    res.setHeader("content-type", "text/x-component");
    res.flushHeaders();
    const reader = rscStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
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
    res.setHeader("content-type", "text/html");
    res.end(
      `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Integration Test</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/entry.browser.js"></script>
  </body>
</html>`
    );
  }

  res.statusCode = 404;
  res.end();
});

server.listen(3000, () => {
  console.log("Running on http://localhost:3000/");
});
