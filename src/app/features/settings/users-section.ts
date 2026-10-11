import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { UsersApi } from '../../core/api/users.api';
import { Role, UserDto } from '../../core/api/users.models';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Notifier } from '../../core/notify/notifier';
import { DateTimePipe } from '../../core/units/date-time.pipe';
import { Dialogs } from '../../shared/dialogs/dialogs.service';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { ROLE_KEYS } from './account-section';
import { PasswordResetDialog, PasswordResetDialogData, UserCreateDialog } from './user-dialogs';

const DIALOG_SIZE = { width: '480px', maxWidth: 'calc(100vw - 32px)' };

/**
 * User management (ADMIN): list, add, change role, reset password, delete. The signed-in account is marked and
 * cannot be changed here (own password: Account section). Backend conflicts (409) get readable messages.
 */
@Component({
  selector: 'app-users-section',
  imports: [
    DateTimePipe, EmptyState, MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, MatTooltipModule,
    Skeleton, TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users-section.html',
  styleUrls: ['./settings-section.scss', './users-section.scss'],
})
export class UsersSection {
  private readonly api = inject(UsersApi);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogs = inject(Dialogs);
  private readonly notifier = inject(Notifier);
  private readonly i18n = inject(I18nService);

  protected readonly roleKeys = ROLE_KEYS;
  protected readonly users = rxResource({ stream: () => this.api.list({ silent: true }) });
  protected readonly list = computed(() => {
    const users = this.users.hasValue() ? this.users.value() ?? [] : [];
    return [...users].sort((a, b) => a.username.localeCompare(b.username));
  });
  protected readonly me = computed(() => this.auth.user()?.username ?? null);
  protected readonly busy = signal<number | null>(null);

  protected async add(): Promise<void> {
    const ref = this.dialog.open<UserCreateDialog, void, UserDto>(UserCreateDialog, DIALOG_SIZE);
    const user = await firstValueFrom(ref.afterClosed());
    if (user) {
      this.users.update(list => [...(list ?? []), user]);
      this.notifier.info(this.i18n.t('settings.users.added', { name: user.username }));
    }
  }

  protected setRole(user: UserDto, role: Role): void {
    this.busy.set(user.id);
    this.api.update(user.id, { role }, { silent: true }).subscribe({
      next: updated => {
        this.busy.set(null);
        this.replace(updated);
        this.notifier.info(this.i18n.t('settings.users.roleChanged',
          { name: updated.username, role: this.i18n.t(ROLE_KEYS[updated.role]) }));
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this.notifier.error(this.conflict(error, 'settings.users.errors.lastAdmin'));
      },
    });
  }

  protected async resetPassword(user: UserDto): Promise<void> {
    const ref = this.dialog.open<PasswordResetDialog, PasswordResetDialogData, boolean>(PasswordResetDialog,
      { ...DIALOG_SIZE, data: { user } });
    if (await firstValueFrom(ref.afterClosed())) {
      this.notifier.info(this.i18n.t('settings.users.passwordReset', { name: user.username }));
    }
  }

  protected async remove(user: UserDto): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: this.i18n.t('settings.users.deleteTitle'),
      message: this.i18n.t('settings.users.deleteText', { name: user.username }),
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(user.id);
    this.api.delete(user.id, { silent: true }).subscribe({
      next: () => {
        this.busy.set(null);
        this.users.update(list => list?.filter(item => item.id !== user.id));
        this.notifier.info(this.i18n.t('settings.users.deleted', { name: user.username }));
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this.notifier.error(this.conflict(error, user.username === this.me()
          ? 'settings.users.errors.self' : 'settings.users.errors.lastAdmin'));
      },
    });
  }

  /** 409 = a business rule of the backend (last admin, own account); other errors as usual. */
  private conflict(error: unknown, key: 'settings.users.errors.lastAdmin' | 'settings.users.errors.self'): string {
    if (error instanceof HttpErrorResponse && error.status === 409) {
      const detail = typeof error.error === 'object' && error.error !== null
        ? String((error.error as { detail?: unknown }).detail ?? '') : '';
      return this.i18n.t(/own account/i.test(detail) ? 'settings.users.errors.self' : key);
    }
    return this.notifier.describe(error);
  }

  private replace(user: UserDto): void {
    this.users.update(list => list?.map(item => (item.id === user.id ? user : item)));
  }
}
