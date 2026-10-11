import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { RouteDto } from '../../core/api';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { DateTimePipe } from '../../core/units/date-time.pipe';
import { DistancePipe } from '../../core/units/distance.pipe';
import { DosePipe } from '../../core/units/dose.pipe';
import { DoseScale } from '../../core/units/dose-scale';
import { DurationPipe } from '../../core/units/duration.pipe';
import { NumberPipe } from '../../core/units/number.pipe';
import { Sparkline } from '../../shared/sparkline/sparkline';
import { TrackThumbnail } from '../../shared/track-thumbnail/track-thumbnail';

/** One route in the card grid: track thumbnail, name, device, date, key numbers, max dose and sparkline. */
@Component({
  selector: 'app-route-card',
  imports: [
    DateTimePipe, DistancePipe, DosePipe, DurationPipe, MatButtonModule, MatCardModule, MatCheckboxModule, MatIconModule,
    MatMenuModule, MatTooltipModule, NumberPipe, RouterLink, Sparkline, TrackThumbnail, TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './route-card.html',
  styleUrl: './route-card.scss',
})
export class RouteCard {
  readonly route = input.required<RouteDto>();
  readonly selected = input(false, { transform: booleanAttribute });
  /** False when 4 routes are selected already (and this one is not). */
  readonly selectable = input(true, { transform: booleanAttribute });
  readonly admin = input(false, { transform: booleanAttribute });

  readonly toggleSelect = output<void>();
  readonly edit = output<void>();
  readonly remove = output<void>();

  protected readonly maxColor = computed(() => {
    const max = this.route().maxUsv;
    return max === null ? null : DoseScale.color(max);
  });
}
