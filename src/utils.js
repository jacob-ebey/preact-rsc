export const ClientReferenceSymbol = Symbol.for("preact.reference.client");

/**
 * @template T
 */
export class Deferred {
  constructor() {
    /** @type {Promise<T>} */
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}
