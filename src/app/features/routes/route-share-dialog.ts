import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouteDto, RoutesApi } from '../../core/api';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Notifier } from '../../core/notify/notifier';
import { Dialogs } from '../../shared/dialogs/dialogs.service';

/** Public link of a shared route. */
export function shareUrl(token: string): string {
  return `${location.origin}/share/${token}`;
}

export interface RouteShareDialogData {
  readonly route: RouteDto;
  /** Called after the link was created or revoked (null). */
  readonly onChange: (token: string | null) => void;
}

/** Creates, copies and revokes the public share link of a route. */
@Component({
  selector: 'app-route-share-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatTooltipModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'routes.share.title' | t }}</h2>
    <mat-dialog-content class="content">
      <p class="intro">{{ 'routes.share.intro' | t }}</p>
      @if (url(); as link) {
        <div class="link-row">
          <label class="label" for="route-share-url">{{ 'routes.share.link' | t }}</label>
          <div class="link">
            <input id="route-share-url" class="url app-num" [value]="link" readonly (focus)="selectAll($event)" />
            <button matIconButton type="button" (click)="copy(link)" [attr.aria-label]="'routes.share.copy' | t"
                    [matTooltip]="'routes.share.copy' | t">
              <mat-icon aria-hidden="true">content_copy</mat-icon>
            </button>
            <a matIconButton [href]="link" target="_blank" rel="noopener" [attr.aria-label]="'routes.share.open' | t"
               [matTooltip]="'routes.share.open' | t">
              <mat-icon aria-hidden="true">open_in_new</mat-icon>
            </a>
          </div>
        </div>
      } @else {
        <p class="state">
          <mat-icon aria-hidden="true">link_off</mat-icon>{{ 'routes.share.notShared' | t }}
        </p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (token()) {
        <button matButton type="button" class="danger" (click)="revoke()" [disabled]="busy()">{{ 'routes.share.revoke' | t }}</button>
        <span class="spacer"></span>
        <button matButton="filled" type="button" (click)="close()">{{ 'common.actions.close' | t }}</button>
      } @else {
        <button matButton type="button" (click)="close()">{{ 'common.actions.cancel' | t }}</button>
        <button matButton="filled" type="button" (click)="create()" [disabled]="busy()">{{ 'routes.share.create' | t }}</button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      gap: var(--app-space-4);
      width: min(520px, 100%);
    }

    .intro {
      max-width: 60ch;
      color: var(--mat-sys-on-surface-variant);
    }

    .link-row {
      display: flex;
      flex-direction: column;
      gap: var(--app-space-1);
    }

    .label {
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface-variant);
    }

    .link {
      display: flex;
      align-items: center;
      gap: var(--app-space-1);
      padding-left: var(--app-space-3);
      border: 1px solid var(--mat-sys-outline);
      border-radius: var(--app-radius-field);
    }

    .url {
      flex: 1;
      min-width: 0;
      padding: 10px 0;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-overflow: ellipsis;

      &:focus-visible {
        outline: none;
      }
    }

    .state {
      display: flex;
      align-items: center;
      gap: var(--app-space-2);
      color: var(--mat-sys-on-surface-variant);
    }

    .spacer {
      flex: 1;
    }

    .danger {
      color: var(--mat-sys-error);
    }
  `,
})
export class RouteShareDialog {
  private readonly api = inject(RoutesApi);
  private readonly clipboard = inject(Clipboard);
  private readonly notifier = inject(Notifier);
  private readonly i18n = inject(I18nService);
  private readonly dialogs = inject(Dialogs);
  private readonly data = inject<RouteShareDialogData>(MAT_DIALOG_DATA);
  private readonly route = this.data.route;
  private readonly dialogRef = inject<MatDialogRef<RouteShareDialog>>(MatDialogRef);

  protected readonly token = signal<string | null>(this.route.shareToken);
  protected readonly url = computed(() => {
    const token = this.token();
    return token ? shareUrl(token) : null;
  });
  protected readonly busy = signal(false);

  protected create(): void {
    this.busy.set(true);
    this.api.share(this.route.id).subscribe({
      next: ({ token }) => {
        this.token.set(token);
        this.data.onChange(token);
        this.busy.set(false);
        this.copy(shareUrl(token));
      },
      error: () => this.busy.set(false),
    });
  }

  protected async revoke(): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: this.i18n.t('routes.share.revokeTitle'),
      message: this.i18n.t('routes.share.revokeMessage'),
      confirmLabel: this.i18n.t('routes.share.revoke'),
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(true);
    this.api.unshare(this.route.id).subscribe({
      next: () => {
        this.token.set(null);
        this.data.onChange(null);
        this.busy.set(false);
        this.notifier.info(this.i18n.t('routes.share.revoked'));
      },
      error: () => this.busy.set(false),
    });
  }

  protected copy(link: string): void {
    this.notifier.info(this.i18n.t(this.clipboard.copy(link) ? 'routes.share.copied' : 'routes.share.copyFailed'));
  }

  protected selectAll(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
