// @jsx h
import { h } from "preact";
import { Suspense } from "preact/compat";

import { Counter } from "./client-components.jsx";

export function App() {
  return (
    <main>
      <h1>Hello, World!</h1>
      <Counter initialValue={2} />
      <Suspense fallback={<h1>Loading...</h1>}>
        <SlowComponent />
      </Suspense>
    </main>
  );
}

async function SlowComponent() {
  const msg = await new Promise((resolve) =>
    setTimeout(() => resolve("I was slow"), 1000)
  );
  return <h1>{msg}</h1>;
}
