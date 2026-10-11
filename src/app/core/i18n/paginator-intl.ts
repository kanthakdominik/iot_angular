import { Injectable, effect, inject } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { I18nService } from './i18n.service';

/** Translated labels of `mat-paginator` (provided in app.config.ts); follows language changes. */
@Injectable()
export class AppPaginatorIntl extends MatPaginatorIntl {
  private readonly i18n = inject(I18nService);

  constructor() {
    super();
    effect(() => {
      this.i18n.lang();
      this.itemsPerPageLabel = this.i18n.t('common.pagination.itemsPerPage');
      this.nextPageLabel = this.i18n.t('common.pagination.next');
      this.previousPageLabel = this.i18n.t('common.pagination.previous');
      this.firstPageLabel = this.i18n.t('common.pagination.first');
      this.lastPageLabel = this.i18n.t('common.pagination.last');
      this.changes.next();
    });
  }

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    const start = length === 0 ? 0 : page * pageSize + 1;
    const end = Math.min(length, (page + 1) * pageSize);
    return this.i18n.t('common.pagination.range', { start, end, total: length });
  };
}
