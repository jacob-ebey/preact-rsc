import { Suspense } from "preact/compat";

import { Deferred, ClientReferenceSymbol } from "./utils.js";

const SuspendRequestedSymbol = Symbol.for("preact-rsc.SuspendRequested");

/**
 * @type {import("./api.js").renderToReadableStream}
 */
export function renderToReadableStream(vnode, options) {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const deferredPending = new Deferred();
      let pendingPromises = 0;
      let _nextId = 0;
      /** @type {Map<string, number>} */
      let sentBuiltins = new Map();
      /** @type {Map<string, number>} */
      let sentReferences = new Map();

      /** @type {import("./internal-types.js").RenderContext} */
      const context = {
        enqueueChunk([type, id, data]) {
          controller.enqueue(
            encoder.encode(`${type}${id}:${JSON.stringify(data)}\n`)
          );
        },
        ensureBuiltin(name) {
          let id = sentBuiltins.get(name);
          if (typeof id === "number") return id;
          id = context.nextId();
          sentBuiltins.set(name, id);
          context.enqueueChunk(["S", id, name]);
          return id;
        },
        ensureReference(type) {
          let id = sentReferences.get(type.$$id);
          if (typeof id === "number") return id;
          if (!options || !options.getClientReferenceData) {
            throw new Error(
              "Missing getClientReferenceData option for client component"
            );
          }
          id = context.nextId();
          sentReferences.set(type.$$id, id);
          const data = options.getClientReferenceData(type.$$id);
          context.enqueueChunk(["M", id, data]);
          return id;
        },
        enqueuePromise(promise) {
          ++pendingPromises;
          promise.then(() => {
            if (--pendingPromises === 0) {
              deferredPending.resolve();
            }
          });
        },
        nextId() {
          return _nextId++;
        },
        requestSuspense() {},
        async waitForSuspense(maybeSuspend) {
          /** @type {Deferred<typeof SuspendRequestedSymbol>} */
          const suspenseDeferred = new Deferred();
          const suspenseContext = {
            ...context,
            requestSuspense() {
              suspenseDeferred.resolve(SuspendRequestedSymbol);
            },
          };

          const pendingPromise = maybeSuspend(suspenseContext);
          const raceResult = await Promise.race([
            suspenseDeferred.promise,
            pendingPromise,
          ]);

          if (raceResult === SuspendRequestedSymbol) {
            return [true, pendingPromise];
          }

          suspenseDeferred.resolve(SuspendRequestedSymbol);
          return [false, raceResult];
        },
      };

      const initialId = context.nextId();
      const rendered = await renderVNode(vnode, context);
      context.enqueueChunk(["J", initialId, rendered]);

      if (pendingPromises === 0) {
        deferredPending.resolve();
      }

      await deferredPending.promise;

      controller.close();
    },
  });
}

/**
 * @param {import("preact").VNode | Promise<import("preact").VNode>} vnode
 * @param {import("./internal-types.js").RenderContext} context
 * @returns {Promise<import("./internal-types.js").RSCElement>}
 */
async function renderVNode(vnode, context) {
  if (isPromiseLike(vnode)) {
    context.requestSuspense();

    return renderVNode(await vnode, context);
  }

  const { props } = vnode;
  const type =
    /** @type {string | (import("preact").ComponentType & { $$typeof: unknown; $$id: string }) | { $$typeof: unknown; $$id: string }} */ (
      vnode.type
    );
  switch (typeof type) {
    case "string":
      return renderElement(type, props, context);
    case "object":
    case "function":
      if (type.$$typeof) {
        return renderReference(type, props, context);
      }
      if (typeof type === "object") {
        throw new Error(`Unknown vnode type: ${type}`);
      }
      return renderComponent(type, props, context);
    default:
      throw new Error(`Unknown vnode type: ${type}`);
  }
}

/**
 *
 * @param {{ $$typeof: unknown; $$id: string }} type
 * @param {{ children?: import("preact").ComponentChildren }} props
 * @param {import("./internal-types.js").RenderContext} context
 * @returns {Promise<import("./internal-types.js").RSCElement>}
 */
async function renderReference(type, props, context) {
  if (type.$$typeof !== ClientReferenceSymbol) {
    throw new Error(`Unknown reference type: ${type.$$typeof}`);
  }
  const { children, ...rest } = props;

  const id = context.ensureReference(type);

  return [
    "$",
    `@${id}`,
    null,
    {
      ...rest,
      children: await renderChildren(children, context),
    },
  ];
}

/**
 * @param {string} type
 * @param {{ children?: import("preact").ComponentChildren }} props
 * @param {import("./internal-types.js").RenderContext} context
 * @returns {Promise<import("./internal-types.js").RSCElement>}
 */
async function renderElement(type, props, context) {
  const { children, ...rest } = props;
  normalizeProperties(rest);

  return [
    "$",
    type,
    null,
    {
      ...rest,
      children: await renderChildren(children, context),
    },
  ];
}

/**
 * @param {import("preact").ComponentType} type
 * @param {{ children?: import("preact").ComponentChildren }} props
 * @param {import("./internal-types.js").RenderContext} context
 * @returns {Promise<import("./internal-types.js").RSCElement>}
 */
async function renderComponent(type, props, context) {
  if (type === Suspense) {
    const suspenseId = context.nextId();
    const suspenseIdentifier = context.ensureBuiltin("Suspense");
    const suspenseResult = await context.waitForSuspense((context) =>
      renderChildren(props.children, context)
    );

    const fallback =
      /** @type {{ fallback?: import("preact").ComponentChild }} */ (props)
        .fallback;
    const fallbackChildren = await renderChildren(fallback, context);
    const fragmentIdentifier = context.ensureBuiltin("Fragment");
    /** @type {import("./internal-types.js").RSCElement} */
    const fallbackChunk = [
      "$",
      `$${fragmentIdentifier}`,
      null,
      { children: fallbackChildren },
    ];

    if (suspenseResult[0]) {
      context.enqueuePromise(
        /** @type {ReturnType<typeof renderChildren>} */ (
          suspenseResult[1]
        ).then((children) => {
          const fragmentId = context.ensureBuiltin("Fragment");
          const rscChunk = ["$", `$${fragmentId}`, null, { children }];
          context.enqueueChunk(["J", suspenseId, rscChunk]);
        })
      );

      /** @type {import("./internal-types.js").RSCElement} */
      const rscHole = ["$", `@${suspenseId}`, null, {}];
      return [
        "$",
        `$${suspenseIdentifier}`,
        fallbackChunk,
        { children: [rscHole] },
      ];
    }

    return [
      "$",
      `$${suspenseIdentifier}`,
      fallbackChunk,
      {
        children: /** @type {import("./internal-types.js").RSCElement[]} */ (
          suspenseResult[1]
        ),
      },
    ];
  }

  if (type.prototype && typeof type.prototype.render === "function") {
    throw new Error("Class components are not supported");
  }

  const vnode = /** @type {import("preact").FunctionComponent} */ (type)(props);
  return renderVNode(vnode, context);
}

async function renderChildren(children, context) {
  if (Array.isArray(children)) {
    const results = [];
    for (const child of children) {
      results.push(await renderChild(child, context));
    }
    return results;
  }

  return [await renderChild(children, context)];
}

/**
 * @param {import("preact").ComponentChild} child
 * @param {import("./internal-types.js").RenderContext} context
 * @returns {Promise<import("./internal-types.js").RSCElement>}
 */
async function renderChild(child, context) {
  switch (typeof child) {
    case "boolean":
    case "number":
    case "string":
      return child;
    case "undefined":
      return null;
    case "object":
      if (child === null) {
        return null;
      }

      return renderVNode(
        /** @type {import("preact").VNode} */ (child),
        context
      );
    default:
      throw new Error(`Unknown child type: ${child}`);
  }
}

/**
 * @param {any} value
 * @returns {value is PromiseLike<any>}
 */
function isPromiseLike(value) {
  return (
    !!value &&
    typeof value === "object" &&
    "then" in value &&
    typeof value.then === "function"
  );
}

function normalizeProperties(props) {
  const { children, ...rest } = props;

  for (const [key, value] of Object.entries(rest)) {
    switch (key) {
      case "className":
        props.class = value;
        delete props[key];
        break;
      case "htmlFor":
        props.for = value;
        delete props[key];
        break;
      // TODO: handle the rest of the special cased properties
    }
  }
}
