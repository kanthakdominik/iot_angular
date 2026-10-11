import { DictShape } from '../i18n.types';
import type { sharePl } from './share.pl';

export const shareEn: DictShape<typeof sharePl> = {
  title: 'Shared route',
  notFound: 'This link is invalid or no longer works.',
  notFoundTitle: 'Shared route not found',
  loadFailed: 'Could not load the shared route',
  readOnly: 'Read-only view',
};
