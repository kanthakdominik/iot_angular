import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { IotData } from '../models/iot-data.model';
import { RadiationLevelService } from './radiation-legend.service';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map!: L.Map;
  private markers: L.CircleMarker[] = [];

  initMap(element: HTMLElement): L.Map {
    this.destroy();

    this.map = L.map(element, {
      minZoom: 2,
      maxZoom: 18,
      zoomControl: true,
      attributionControl: false
    }).setView([0, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);
    return this.map;
  }

  isMapInitialized(): boolean {
    return !!this.map;
  }

  updateMapWithData(routeData: IotData[], onDeletePoint?: (id: number) => void): void {
    if (!this.map || !routeData.length) return;

    this.clearMarkers();
    const coordinates: L.LatLng[] = [];

    routeData.forEach(point => {
      const latLng = L.latLng(point.latitude, point.longitude);
      coordinates.push(latLng);
      this.addMarker(point, latLng, onDeletePoint);
    });

    this.map.fitBounds(L.latLngBounds(coordinates));
  }

  private clearMarkers(): void {
    this.markers.forEach(marker => marker.remove());
    this.markers = [];
  }

  private addMarker(point: IotData, latLng: L.LatLng, onDeletePoint?: (id: number) => void): void {
    const marker = L.circleMarker(latLng, {
      radius: 8,
      fillColor: this.getColorForUsv(point.usvPerHour),
      color: '#transparent',
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    });

    const timestamp = new Date(point.timestamp).toLocaleString();
    const popup = L.popup().setContent(`
      <div class="popup-content">
        <p><strong>Time:</strong> ${timestamp}</p>
        <p><strong>Radiation:</strong> ${point.usvPerHour.toFixed(3)} µSv/h</p>
        <p><strong>CPM:</strong> ${point.cpm}</p>
        <p><strong>Location:</strong> ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}</p>
        ${onDeletePoint ? `
          <button type="button" class="delete-point-btn" data-point-id="${point.id}" title="Delete point">
            <i class="fas fa-trash"></i>
          </button>
        ` : ''}
      </div>
    `);

    marker.bindPopup(popup);

    if (onDeletePoint) {
      let clickHandler: ((e: Event) => void) | null = null;

      marker.on('popupopen', () => {
        const deleteBtn = marker.getPopup()?.getElement()?.querySelector(
          `.delete-point-btn[data-point-id="${point.id}"]`
        ) as HTMLElement | null;

        if (deleteBtn) {
          if (clickHandler) {
            deleteBtn.removeEventListener('click', clickHandler);
          }

          clickHandler = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            marker.closePopup();
            onDeletePoint(point.id);
          };
          deleteBtn.addEventListener('click', clickHandler);
        }
      });

      marker.on('popupclose', () => {
        clickHandler = null;
      });
    }

    marker.addTo(this.map);
    this.markers.push(marker);
  }

  destroy(): void {
    this.clearMarkers();
    if (this.map) {
      this.map.remove();
      this.map = undefined as any;
    }
  }

  private getColorForUsv(usv: number): string {
    return RadiationLevelService.getColorForUsv(usv);
  }
}
