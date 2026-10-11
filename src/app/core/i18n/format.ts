import { TranslateParams } from './i18n.types';

const numberFormats = new Map<string, Intl.NumberFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();

function numberFormat(locale: string): Intl.NumberFormat {
  let format = numberFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale);
    numberFormats.set(locale, format);
  }
  return format;
}

function plurals(locale: string): Intl.PluralRules {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  return rules;
}

/** Index of the brace closing the one at `open`, or -1. */
function closingBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') {
      depth++;
    } else if (text[i] === '}' && --depth === 0) {
      return i;
    }
  }
  return -1;
}

const PLURAL = /^\s*(\w+)\s*,\s*plural\s*,([\s\S]*)$/;

/** Parses `one {...} few {...} =0 {...} other {...}`. */
function pluralOptions(source: string): Map<string, string> {
  const options = new Map<string, string>();
  let i = 0;
  while (i < source.length) {
    const open = source.indexOf('{', i);
    const close = open < 0 ? -1 : closingBrace(source, open);
    if (close < 0) {
      break;
    }
    options.set(source.slice(i, open).trim(), source.slice(open + 1, close));
    i = close + 1;
  }
  return options;
}

function placeholder(body: string, params: TranslateParams, locale: string): string {
  const plural = PLURAL.exec(body);
  if (!plural) {
    const value = params[body.trim()];
    if (value === null || value === undefined) {
      return '';
    }
    return typeof value === 'number' ? numberFormat(locale).format(value) : value;
  }
  const count = Number(params[plural[1]] ?? 0);
  const options = pluralOptions(plural[2]);
  const text = options.get(`=${count}`) ?? options.get(plurals(locale).select(count)) ?? options.get('other') ?? '';
  return formatMessage(text.replace(/#/g, numberFormat(locale).format(count)), params, locale);
}

/**
 * Minimal ICU-like formatting: `{name}` placeholders (numbers are locale-formatted) and
 * `{count, plural, =0 {...} one {# item} few {# items} many {...} other {...}}` with `#` = the formatted count.
 */
export function formatMessage(template: string, params: TranslateParams | undefined, locale: string): string {
  if (!params || !template.includes('{')) {
    return template;
  }
  let result = '';
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf('{', i);
    const close = open < 0 ? -1 : closingBrace(template, open);
    if (close < 0) {
      result += template.slice(i);
      break;
    }
    result += template.slice(i, open) + placeholder(template.slice(open + 1, close), params, locale);
    i = close + 1;
  }
  return result;
}
