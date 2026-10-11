import {
  ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, input, signal, viewChild,
} from '@angular/core';
import { ActivityDay } from '../../core/api/stats.models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { DoseFormat } from '../../core/units/dose-format';
import { dateFormat } from '../../core/units/format-utils';

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT = 30;
const TOP = 18;
const DAYS = 365;

interface Cell {
  readonly key: string;
  readonly date: Date;
  readonly x: number;
  readonly y: number;
  readonly level: 0 | 1 | 2 | 3 | 4;
  readonly day: ActivityDay | null;
}

interface Label {
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

/** Local calendar date "YYYY-MM-DD" (the activity API uses local dates). */
export function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Monday = 0 … Sunday = 6. */
function weekday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function level(samples: number, max: number): Cell['level'] {
  if (!(samples > 0) || !(max > 0)) {
    return 0;
  }
  return (1 + Math.min(3, Math.floor((4 * Math.log1p(samples)) / Math.log1p(max) - 1e-9))) as Cell['level'];
}

/**
 * GitHub-style activity grid of the last 365 days: one column per week, rows Monday–Sunday, cell intensity = number
 * of samples (log scale). Hover or keyboard (arrows, Home / End when focused) shows the day's samples, routes and
 * highest reading; the focused day is also announced through a live region.
 */
@Component({
  selector: 'app-activity-calendar',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './activity-calendar.html',
  styleUrl: './activity-calendar.scss',
})
export class ActivityCalendar {
  private readonly i18n = inject(I18nService);
  private readonly dose = inject(DoseFormat);

  /** Days with data (other days are empty cells). */
  readonly days = input<readonly ActivityDay[]>([]);
  /** Last day of the grid (default: today). */
  readonly end = input<Date>(new Date());

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  protected readonly active = signal<number | null>(null);
  /** Viewport position of the active cell – the tooltip is `position: fixed`, so the scroller cannot clip it. */
  private readonly anchor = signal<{ x: number; top: number; bottom: number } | null>(null);
  protected readonly keyboard = signal(false);

  private readonly grid = computed(() => {
    const end = this.end();
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const first = addDays(last, -(DAYS - 1));
    const gridStart = addDays(first, -weekday(first));
    const byDate = new Map(this.days().map(day => [day.date, day]));
    const max = this.days().reduce((m, day) => Math.max(m, day.samples), 0);
    const cells: Cell[] = [];
    for (let date = first; date <= last; date = addDays(date, 1)) {
      const key = localDateKey(date);
      const day = byDate.get(key) ?? null;
      const column = Math.floor(Math.round((date.getTime() - gridStart.getTime()) / 86_400_000) / 7);
      cells.push({
        key, date, day,
        x: LEFT + column * STEP,
        y: TOP + weekday(date) * STEP,
        level: level(day?.samples ?? 0, max),
      });
    }
    const weeks = Math.floor(Math.round((last.getTime() - gridStart.getTime()) / 86_400_000) / 7) + 1;
    return { cells, weeks, max };
  });

  protected readonly cells = computed(() => this.grid().cells);
  protected readonly width = computed(() => LEFT + this.grid().weeks * STEP - GAP);
  protected readonly height = TOP + 7 * STEP - GAP;
  protected readonly cellSize = CELL;
  protected readonly legendLevels = [0, 1, 2, 3, 4] as const;

  /** A month label above the first column (week) that starts in a new month; a too-narrow first one is dropped. */
  protected readonly monthLabels = computed<Label[]>(() => {
    const format = new Intl.DateTimeFormat(this.i18n.locale(), { month: 'short' });
    const candidates: Label[] = [];
    let previousMonth = -1;
    this.cells().forEach((cell, index) => {
      if (index > 0 && weekday(cell.date) !== 0) {
        return;
      }
      const month = cell.date.getMonth();
      if (month !== previousMonth) {
        candidates.push({ text: format.format(cell.date), x: cell.x, y: TOP - 6 });
        previousMonth = month;
      }
    });
    return candidates.filter((label, i) => i + 1 >= candidates.length || candidates[i + 1].x - label.x >= 3 * STEP);
  });

  protected readonly weekdayLabels = computed<Label[]>(() => {
    const format = new Intl.DateTimeFormat(this.i18n.locale(), { weekday: 'short' });
    const monday = new Date(2024, 0, 1); // a Monday
    return [0, 2, 4].map(row => ({
      text: format.format(addDays(monday, row)),
      x: 0,
      y: TOP + row * STEP + CELL - 2,
    }));
  });

  protected readonly summary = computed(() => {
    const days = this.days();
    return this.i18n.t('dashboard.activity.summary', {
      days: days.length,
      samples: days.reduce((sum, day) => sum + day.samples, 0),
    });
  });

  protected readonly activeCell = computed(() => {
    const index = this.active();
    return index === null ? null : this.cells()[index] ?? null;
  });

  protected readonly tooltip = computed(() => {
    const cell = this.activeCell();
    const anchor = this.anchor();
    if (!cell || !anchor) {
      return null;
    }
    const below = anchor.top < 96;
    return {
      left: anchor.x,
      top: below ? anchor.bottom + 6 : anchor.top - 6,
      below,
      date: dateFormat(this.i18n.locale(), 'dateLong').format(cell.date),
      lines: this.describe(cell),
    };
  });

  /** Text of the focused day for the live region (keyboard only). */
  protected readonly announcement = computed(() => {
    const tip = this.tooltip();
    return this.keyboard() && tip ? `${tip.date}: ${tip.lines.join(', ')}` : '';
  });

  constructor() {
    // phones: start scrolled to the most recent weeks
    afterNextRender(() => {
      const element = this.scroller()?.nativeElement;
      if (element) {
        element.scrollLeft = element.scrollWidth;
      }
    });
  }

  protected pointerOver(event: PointerEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const index = target?.getAttribute('data-i');
    if (target && index) {
      this.keyboard.set(false);
      this.activate(Number(index), target);
    }
  }

  protected pointerLeave(): void {
    if (!this.keyboard()) {
      this.deactivate();
    }
  }

  protected focus(): void {
    this.keyboard.set(true);
    this.activate(this.active() ?? this.cells().length - 1);
  }

  protected blur(): void {
    this.keyboard.set(false);
    this.deactivate();
  }

  protected keydown(event: KeyboardEvent): void {
    const count = this.cells().length;
    const current = this.active() ?? count - 1;
    const moves: Readonly<Record<string, number>> = {
      ArrowLeft: current - 7, ArrowRight: current + 7, ArrowUp: current - 1, ArrowDown: current + 1,
      Home: 0, End: count - 1,
    };
    const next = moves[event.key];
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    this.keyboard.set(true);
    this.activate(Math.min(count - 1, Math.max(0, next)));
  }

  private activate(index: number, element?: Element): void {
    const cell = element ?? this.host.nativeElement.querySelector(`rect[data-i="${index}"]`);
    if (!cell) {
      return;
    }
    if (!element) {
      cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    const rect = cell.getBoundingClientRect();
    this.anchor.set({ x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom });
    this.active.set(index);
  }

  private deactivate(): void {
    this.active.set(null);
    this.anchor.set(null);
  }

  private describe(cell: Cell): string[] {
    const day = cell.day;
    if (!day || day.samples === 0) {
      return [this.i18n.t('dashboard.activity.noData')];
    }
    return [
      this.i18n.t('dashboard.activity.samples', { count: day.samples }),
      this.i18n.t('dashboard.activity.routes', { count: day.routes }),
      this.i18n.t('dashboard.activity.max', { value: this.dose.format(day.maxUsv) }),
    ];
  }
}
