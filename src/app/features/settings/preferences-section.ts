import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import {
  DOSE_UNITS, DoseUnit, LANGS, Lang, MAP_LAYER_KEYS, MapLayerKey, Preferences, THEME_PREFS, ThemePref,
} from '../../core/api/users.models';
import { TranslationKey } from '../../core/i18n/pl';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PrefsService } from '../../core/prefs/prefs.service';
import { DoseFormat } from '../../core/units/dose-format';
import { THEME_ICONS, THEME_LABEL_KEYS } from '../../layout/nav/nav-items';
import { DoseReadout } from '../../shared/dose-readout/dose-readout';

const LANG_KEYS: Readonly<Record<Lang, TranslationKey>> = { pl: 'common.language.pl', en: 'common.language.en' };
const LAYER_KEYS: Readonly<Record<MapLayerKey, TranslationKey>> = {
  osm: 'map.layers.osm',
  satellite: 'map.layers.satellite',
  topo: 'map.layers.topo',
  dark: 'map.layers.dark',
};
/** A typical background reading, used for the unit preview. */
const SAMPLE_USV = 0.184;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Theme, language, dose unit (with a live preview) and default map layer – applied at once, saved on the server. */
@Component({
  selector: 'app-preferences-section',
  imports: [DoseReadout, MatButtonToggleModule, MatFormFieldModule, MatIconModule, MatSelectModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preferences-section.html',
  styleUrl: './settings-section.scss',
})
export class PreferencesSection {
  protected readonly prefsService = inject(PrefsService);
  private readonly dose = inject(DoseFormat);

  protected readonly prefs = this.prefsService.prefs;
  protected readonly themes = THEME_PREFS;
  protected readonly themeIcons = THEME_ICONS;
  protected readonly themeKeys = THEME_LABEL_KEYS;
  protected readonly langs = LANGS;
  protected readonly langKeys = LANG_KEYS;
  protected readonly units = DOSE_UNITS;
  protected readonly layers = MAP_LAYER_KEYS;
  protected readonly layerKeys = LAYER_KEYS;
  protected readonly sample = SAMPLE_USV;

  protected readonly state = signal<SaveState>('idle');
  protected readonly unitLabels = computed(() =>
    Object.fromEntries(DOSE_UNITS.map(unit => [unit, this.dose.unitLabel('rate', unit)])) as Record<DoseUnit, string>);
  /** "0,184 µSv/h = 184 nSv/h = 18,4 µR/h" */
  protected readonly equivalents = computed(() =>
    DOSE_UNITS.map(unit => this.dose.format(SAMPLE_USV, 'rate', unit)).join(' = '));

  protected setTheme(change: MatButtonToggleChange): void {
    void this.save({ theme: change.value as ThemePref });
  }

  protected setLanguage(change: MatButtonToggleChange): void {
    void this.save({ language: change.value as Lang });
  }

  protected setUnit(change: MatButtonToggleChange): void {
    void this.save({ doseUnit: change.value as DoseUnit });
  }

  protected setLayer(change: MatSelectChange): void {
    void this.save({ mapLayer: change.value as MapLayerKey });
  }

  private async save(patch: Partial<Preferences>): Promise<void> {
    this.state.set('saving');
    try {
      await this.prefsService.update(patch);
      this.state.set('saved');
    } catch {
      // reverted by PrefsService; the interceptor has shown the reason
      this.state.set('error');
    }
  }
}
