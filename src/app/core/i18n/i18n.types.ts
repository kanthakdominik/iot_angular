/** A dictionary: nested objects with string leaves. */
export interface Dict {
  readonly [key: string]: string | Dict;
}

/** Same keys as `T`, any string values – used to type the EN dictionaries against the PL source of truth. */
export type DictShape<T> = { readonly [K in keyof T]: T[K] extends string ? string : DictShape<T[K]> };

/** Dot-separated paths of all string leaves of `T` ("routes.title"). */
export type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Values for `{name}` placeholders and `{count, plural, ...}` selectors. */
export type TranslateParams = Readonly<Record<string, string | number | null | undefined>>;
