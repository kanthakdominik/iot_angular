import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { Measurement, PositionedMeasurement, hasPosition } from '../models/measurement.model';
import { Marker } from '../models/marker.model';
import { RadiationLevelService } from './radiation-legend.service';

export interface MapCallbacks {
  /** Admin only: delete a measurement. */
  onDeletePoint?: (measurement: Measurement) => void;
  /** Admin only: add a marker at the position of a measurement. */
  onAddMarker?: (measurement: Measurement) => void;
  /** Admin only: delete a marker. */
  onDeleteMarker?: (marker: Marker) => void;
}

/**
 * Leaflet map of a route. Only samples with a GNSS fix are drawn; samples without position are shown on the chart.
 * Uses the canvas renderer, which keeps the map fluent with thousands of points.
 */
@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map?: L.Map;
  private pointsLayer = L.layerGroup();
  private markersLayer = L.layerGroup();

  initMap(element: HTMLElement): L.Map {
    this.destroy();

    this.map = L.map(element, {
      minZoom: 2,
      maxZoom: 19,
      zoomControl: true,
      preferCanvas: true
    }).setView([52.0, 19.0], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.pointsLayer = L.layerGroup().addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
    return this.map;
  }

  isMapInitialized(): boolean {
    return !!this.map;
  }

  /** Draws the samples and markers; fits the view to the route when fitBounds is true. */
  update(measurements: Measurement[], markers: Marker[], callbacks: MapCallbacks, fitBounds = true): void {
    if (!this.map) {
      return;
    }
    this.pointsLayer.clearLayers();
    this.markersLayer.clearLayers();

    const positioned = measurements.filter(hasPosition);
    const bounds: L.LatLng[] = [];

    for (const m of positioned) {
      const latLng = L.latLng(m.latitude, m.longitude);
      bounds.push(latLng);
      this.addPoint(m, latLng, callbacks);
    }
    for (const marker of markers) {
      if (marker.latitude !== null && marker.longitude !== null) {
        const latLng = L.latLng(marker.latitude, marker.longitude);
        bounds.push(latLng);
        this.addMarker(marker, latLng, callbacks);
      }
    }

    if (fitBounds && bounds.length > 0) {
      this.map.fitBounds(L.latLngBounds(bounds), { padding: [20, 20], maxZoom: 18 });
    }
  }

  invalidateSize(): void {
    this.map?.invalidateSize();
  }

  destroy(): void {
    this.pointsLayer.clearLayers();
    this.markersLayer.clearLayers();
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
  }

  private addPoint(m: PositionedMeasurement, latLng: L.LatLng, callbacks: MapCallbacks): void {
    const circle = L.circleMarker(latLng, {
      radius: 7,
      fillColor: RadiationLevelService.getColorForUsv(m.usvPerHour),
      color: '#333',
      weight: 0.5,
      opacity: 0.8,
      fillOpacity: 0.85
    });

    const content = document.createElement('div');
    content.className = 'popup-content';
    content.innerHTML = `
      <p><strong>Time:</strong> ${new Date(m.timestamp).toLocaleString()}</p>
      <p><strong>Radiation:</strong> ${m.usvPerHour.toFixed(3)} µSv/h</p>
      <p><strong>CPM:</strong> ${m.cpm} &nbsp; <strong>CPS:</strong> ${m.cps}</p>
      <p><strong>Location:</strong> ${m.latitude.toFixed(6)}, ${m.longitude.toFixed(6)}</p>
      ${m.satellites !== null ? `<p><strong>Satellites:</strong> ${m.satellites}</p>` : ''}
      <p class="text-muted small">#${m.seq} · ${m.mode}</p>`;

    if (callbacks.onAddMarker || callbacks.onDeletePoint) {
      const actions = document.createElement('div');
      actions.className = 'popup-actions';
      if (callbacks.onAddMarker) {
        actions.appendChild(this.button('Add marker', 'add-marker-btn', () => {
          circle.closePopup();
          callbacks.onAddMarker!(m);
        }));
      }
      if (callbacks.onDeletePoint) {
        actions.appendChild(this.button('Delete point', 'delete-point-btn', () => {
          circle.closePopup();
          callbacks.onDeletePoint!(m);
        }));
      }
      content.appendChild(actions);
    }

    circle.bindPopup(content);
    circle.addTo(this.pointsLayer);
  }

  private addMarker(marker: Marker, latLng: L.LatLng, callbacks: MapCallbacks): void {
    const icon = L.divIcon({
      className: 'route-marker-icon',
      html: '<span class="material-icons">place</span>',
      iconSize: [32, 32],
      iconAnchor: [16, 30],
      popupAnchor: [0, -28]
    });
    const leafletMarker = L.marker(latLng, { icon, title: marker.label });

    const content = document.createElement('div');
    content.className = 'popup-content';
    const title = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = marker.label;   // textContent: user input is never interpreted as HTML
    title.appendChild(strong);
    content.appendChild(title);
    const meta = document.createElement('p');
    meta.className = 'text-muted small';
    meta.textContent = `${new Date(marker.timestamp).toLocaleString()} · ${marker.source}`;
    content.appendChild(meta);

    if (callbacks.onDeleteMarker) {
      const actions = document.createElement('div');
      actions.className = 'popup-actions';
      actions.appendChild(this.button('Delete marker', 'delete-point-btn', () => {
        leafletMarker.closePopup();
        callbacks.onDeleteMarker!(marker);
      }));
      content.appendChild(actions);
    }

    leafletMarker.bindPopup(content);
    leafletMarker.addTo(this.markersLayer);
  }

  private button(label: string, cssClass: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = cssClass;
    btn.textContent = label;
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  }
}
