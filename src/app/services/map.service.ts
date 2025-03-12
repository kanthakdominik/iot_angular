import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { IotData } from '../models/iot-data.model';
import { RadiationLevelService } from './radiation-level.service';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map!: L.Map;
  private markers: L.CircleMarker[] = [];
  private polyline: L.Polyline | null = null;

  initMap(element: HTMLElement): L.Map {
    this.destroy();

    this.map = L.map(element, {
      minZoom: 2,
      maxZoom: 18,
      zoomControl: true
    }).setView([0, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);
    return this.map;
  }

  isMapInitialized(): boolean {
    return !!this.map;
  }

  updateMapWithData(routeData: IotData[]): void {
    if (!this.map || !routeData.length) return;

    this.clearMarkers();
    const coordinates: L.LatLng[] = [];

    routeData.forEach(point => {
      const latLng = L.latLng(point.latitude, point.longitude);
      coordinates.push(latLng);
      this.addMarker(point, latLng);
    });

    this.drawPath(coordinates);
    this.map.fitBounds(L.latLngBounds(coordinates));
  }

  private clearMarkers(): void {
    this.markers.forEach(marker => marker.remove());
    this.markers = [];
  }

  private addMarker(point: IotData, latLng: L.LatLng): void {
    const marker = L.circleMarker(latLng, {
      radius: 8,
      fillColor: this.getColorForUsv(point.usvPerHour),
      color: '#000',
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    });

    marker.bindPopup(`
      <strong>USV/Hour:</strong> ${point.usvPerHour}<br>
      <strong>Location:</strong> ${point.latitude}, ${point.longitude}
    `);

    marker.addTo(this.map);
    this.markers.push(marker);
  }

  private drawPath(coordinates: L.LatLng[]): void {
    if (this.polyline) {
      this.polyline.remove();
    }

    if (coordinates.length > 0) {
      L.polyline(coordinates, {
        color: '#0066cc',
        weight: 3,
        opacity: 0.6
      }).addTo(this.map);
    }
  }

  destroy(): void {
    this.clearMarkers();
    if (this.polyline) {
      this.polyline.remove();
      this.polyline = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = undefined as any;
    }
  }

  private getColorForUsv(usv: number): string {
    return RadiationLevelService.getColorForUsv(usv);
  }
}