import { DOCUMENT, Injectable, computed, effect, inject, isDevMode } from '@angular/core';
import { Lang } from '../api/users.models';
import { PrefsService } from '../prefs/prefs.service';
import { en } from './en';
import { formatMessage } from './format';
import { Dict, TranslateParams } from './i18n.types';
import { TranslationKey, pl } from './pl';

const DICTS: Readonly<Record<Lang, Dict>> = { pl, en };

/** BCP 47 locale used for Intl formatting (24 h clock and day-month order also in English). */
const LOCALES: Readonly<Record<Lang, string>> = { pl: 'pl-PL', en: 'en-GB' };

const lookupCache = new Map<string, string | undefined>();

function lookup(lang: Lang, key: string): string | undefined {
  const cacheKey = `${lang}:${key}`;
  if (lookupCache.has(cacheKey)) {
    return lookupCache.get(cacheKey);
  }
  let node: string | Dict | undefined = DICTS[lang];
  for (const part of key.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  const value = typeof node === 'string' ? node : undefined;
  lookupCache.set(cacheKey, value);
  return value;
}

/**
 * Runtime translations. The language follows the preferences (server-side when logged in, localStorage otherwise).
 * Templates use the `t` pipe; code uses `t()` (typed keys) or `translate()` for keys built at runtime.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly prefs = inject(PrefsService);
  private readonly document = inject(DOCUMENT);

  readonly lang = computed<Lang>(() => this.prefs.prefs().language);
  /** Locale for `Intl.*` APIs. */
  readonly locale = computed(() => LOCALES[this.lang()]);

  constructor() {
    effect(() => this.document.documentElement.setAttribute('lang', this.lang()));
  }

  /** Translates a known key; reading it inside a template / computed tracks the language. */
  t(key: TranslationKey, params?: TranslateParams): string {
    return this.translate(key, params);
  }

  /** Like `t()` for keys composed at runtime (e.g. `events.types.${type}`); falls back to Polish, then to the key. */
  translate(key: string, params?: TranslateParams): string {
    const lang = this.lang();
    const template = lookup(lang, key) ?? lookup('pl', key);
    if (template === undefined) {
      if (isDevMode()) {
        console.warn(`Missing translation: ${key}`);
      }
      return key;
    }
    return formatMessage(template, params, this.locale());
  }

  has(key: string): boolean {
    return lookup('pl', key) !== undefined;
  }
}
