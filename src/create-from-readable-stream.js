import { h, Fragment } from "preact";
import { Suspense } from "preact/compat";

import { Deferred } from "./utils.js";

const builtinsToComponent = {
  Fragment,
  Suspense,
};

/** @type {import("./api.js").createFromReadableStream} */
export async function createFromReadableStream(stream, options) {
  // Read the stream in chunks separated by newlines
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  // The first chunk is the root element

  let sentFirstChunk = false;
  let firstChunkDeferred = new Deferred();

  (async () => {
    let done = false;
    let line,
      rest = "";

    const builtinsMap = new Map();
    const holesMap = new Map();
    const referencesDataMap = new Map();

    const getClientReference = (data) => {
      if (!options || !options.getClientReference) {
        throw new Error("Missing getClientReference option");
      }

      let Reference;
      const referencePromise = Promise.resolve(
        options.getClientReference(data)
      ).then((ref) => {
        Reference = ref;
      });

      return (props) => {
        if (Reference) {
          return h(Reference, props);
        }
        throw referencePromise;
      };
    };

    while (!done) {
      [done, line, rest] = await readToNewLine(reader, decoder, rest);

      if (!done) {
        const chunkType =
          /** @type {import("./internal-types.js").RSCChunkType} */ (line[0]);
        const separatorIdx = line.indexOf(":");
        const chunkId = parseInt(line.slice(1, separatorIdx));
        const chunkData = JSON.parse(line.slice(separatorIdx + 1));

        if (!Number.isSafeInteger(chunkId)) {
          throw new Error("Invalid chunk ID");
        }

        switch (chunkType) {
          case "M":
            referencesDataMap.set(chunkId, chunkData);
            break;
          case "S":
            if (!builtinsToComponent[chunkData]) {
              throw new Error("Unknown builtin '" + chunkData + "'");
            }
            builtinsMap.set(chunkId, chunkData);
            break;
          case "J":
            const node = createVNode(
              chunkData,
              builtinsMap,
              holesMap,
              referencesDataMap,
              getClientReference
            );
            if (sentFirstChunk) {
              holesMap.get(chunkId).resolve(node);
              break;
            }
            firstChunkDeferred.resolve(node);
            sentFirstChunk = true;
            break;
          default:
            throw new Error("Invalid chunk type");
        }
      }
    }
  })();

  return await firstChunkDeferred.promise;
}

/**
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader
 * @param {TextDecoder} decoder
 * @param {string} previousRest
 * @returns {Promise<[boolean, string, string]>}
 */
async function readToNewLine(reader, decoder, previousRest) {
  let rest = previousRest;
  let line = "";
  let done = false;
  while (true) {
    const read = await reader.read();
    if (read.done) {
      done = true;
      break;
    }

    const chunk = decoder.decode(read.value, { stream: true });
    const newlineIdx = chunk.indexOf("\n");
    if (newlineIdx === -1) {
      rest += chunk;
    } else {
      line += rest + chunk.slice(0, newlineIdx);
      rest = chunk.slice(newlineIdx + 1);
      break;
    }
  }

  return [done, line, rest];
}

function parseId(type) {
  const id = Number.parseInt(type.slice(1));
  if (!Number.isSafeInteger(id)) {
    throw new Error("Invalid ID");
  }
  return id;
}

/**
 *
 * @param {import("./internal-types.js").RSCElement} chunkData
 * @param {Map<number, string>} builtinsMap
 * @param {Map<number, Deferred>} holesMap
 * @param {Map<number, unknown>} referencesDataMap
 * @param {(data: unknown) => import("preact").ComponentType<any>} getClientReference
 */
function createVNode(
  chunkData,
  builtinsMap,
  holesMap,
  referencesDataMap,
  getClientReference
) {
  if (typeof chunkData !== "object" || !Array.isArray(chunkData)) {
    return chunkData;
  }

  if (chunkData[0] !== "$") throw new Error("Invalid element");
  const type = chunkData[1];

  switch (type[0]) {
    case "$": {
      const id = parseId(type);
      const builtin = builtinsToComponent[builtinsMap.get(id)];
      if (!builtin) {
        throw new Error("Unknown builtin");
      }

      const props = chunkData[3];
      const children = props.children?.map((child) =>
        createVNode(
          child,
          builtinsMap,
          holesMap,
          referencesDataMap,
          getClientReference
        )
      );

      if (builtin === Suspense) {
        /** @type {any} **/ (props).fallback = createVNode(
          chunkData[2],
          builtinsMap,
          holesMap,
          referencesDataMap,
          getClientReference
        );
      }

      return h(builtin, {
        ...props,
        children,
      });
    }
    case "@": {
      const id = parseId(type);

      if (referencesDataMap.has(id)) {
        const Reference = getClientReference(referencesDataMap.get(id));
        const props = chunkData[3];
        const children = props.children?.map((child) =>
          createVNode(
            child,
            builtinsMap,
            holesMap,
            referencesDataMap,
            getClientReference
          )
        );
        return h(Reference, {
          ...props,
          children,
        });
      }

      const holeDeferred = new Deferred();
      holesMap.set(id, holeDeferred);
      let filling;
      let resolved = false;
      let promiseToThrow = holeDeferred.promise.then((v) => {
        resolved = true;
        filling = v;
      });
      const Hole = () => {
        if (resolved) {
          return filling;
        }
        throw promiseToThrow;
      };
      Hole.displayName = `Hole${id}`;
      return h(Hole, {});
    }
    default: {
      const props = chunkData[3];
      const children = props.children?.map((child) =>
        createVNode(
          child,
          builtinsMap,
          holesMap,
          referencesDataMap,
          getClientReference
        )
      );
      return h(type, {
        ...props,
        children,
      });
    }
  }
}
