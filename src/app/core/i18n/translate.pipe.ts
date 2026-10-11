import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';
import { TranslateParams } from './i18n.types';
import { TranslationKey } from './pl';

/**
 * `{{ 'routes.title' | t }}`, `{{ 'nav.search.noResults' | t: { q: query() } }}`.
 * Impure so it follows language changes; the result is memoised per key, params and language.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  private key?: string;
  private params?: TranslateParams;
  private lang?: string;
  private value = '';

  transform(key: TranslationKey, params?: TranslateParams): string {
    const lang = this.i18n.lang();
    if (key !== this.key || params !== this.params || lang !== this.lang) {
      this.key = key;
      this.params = params;
      this.lang = lang;
      this.value = this.i18n.t(key, params);
    }
    return this.value;
  }
}
