import * as L from 'leaflet';

/** A Leaflet control whose content is an existing element (e.g. the host element of an Angular component). */
export class ElementControl extends L.Control {
  constructor(private readonly element: HTMLElement, options?: L.ControlOptions) {
    super(options);
  }

  override onAdd(): HTMLElement {
    L.DomEvent.disableClickPropagation(this.element);
    L.DomEvent.disableScrollPropagation(this.element);
    return this.element;
  }
}

export interface FullscreenLabels {
  readonly enter: string;
  readonly exit: string;
}

/**
 * Full-screen toggle using the Fullscreen API. `target` defaults to the map container – pass a wrapper to keep
 * overlays (playback bar, legend outside the map) visible in full screen. Hidden where the API is unavailable (iPhone).
 */
export class FullscreenControl extends L.Control {
  private button?: HTMLButtonElement;
  private icon?: HTMLSpanElement;
  private map?: L.Map;

  constructor(private readonly labels: FullscreenLabels, private readonly target?: HTMLElement,
              options: L.ControlOptions = { position: 'topleft' }) {
    super(options);
  }

  override onAdd(map: L.Map): HTMLElement {
    this.map = map;
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    if (!document.fullscreenEnabled) {
      container.hidden = true;
      return container;
    }
    const button = L.DomUtil.create('button', 'app-map-control-button', container) as HTMLButtonElement;
    button.type = 'button';
    this.icon = L.DomUtil.create('span', 'material-symbols-rounded', button);
    this.icon.setAttribute('aria-hidden', 'true');
    this.button = button;
    this.update();
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(button, 'click', () => this.toggle());
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    return container;
  }

  override onRemove(): void {
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
  }

  toggle(): void {
    const element = this.element();
    if (!element) {
      return;
    }
    if (document.fullscreenElement === element) {
      void document.exitFullscreen();
    } else {
      void element.requestFullscreen().catch(() => undefined);
    }
  }

  private element(): HTMLElement | undefined {
    return this.target ?? this.map?.getContainer();
  }

  private readonly onFullscreenChange = () => {
    this.update();
    this.map?.invalidateSize();
  };

  private update(): void {
    const active = !!this.element() && document.fullscreenElement === this.element();
    const label = active ? this.labels.exit : this.labels.enter;
    if (this.button && this.icon) {
      this.button.title = label;
      this.button.setAttribute('aria-label', label);
      this.button.setAttribute('aria-pressed', String(active));
      this.icon.textContent = active ? 'fullscreen_exit' : 'fullscreen';
    }
  }
}
