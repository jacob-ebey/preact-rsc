// @jsx h
import { h } from "preact";
import { useState } from "preact/hooks";

export function Counter({ initialValue }) {
  const [count, setCount] = useState(initialValue || 0);
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
Object.defineProperties(Counter, {
  $$typeof: { value: Symbol.for("preact.reference.client") },
  $$id: { value: "Counter" },
});
