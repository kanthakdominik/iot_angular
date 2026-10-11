/** Remembers the last result of an impure pipe and recomputes only when one of the arguments changes. */
export class Memo<T> {
  private args?: readonly unknown[];
  private value?: T;

  get(args: readonly unknown[], compute: () => T): T {
    const last = this.args;
    if (last && last.length === args.length && args.every((arg, i) => Object.is(arg, last[i]))) {
      return this.value as T;
    }
    this.args = args;
    this.value = compute();
    return this.value;
  }
}
