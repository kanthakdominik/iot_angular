import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { RouteService } from '../../services/route.service';
import { IotData } from '../../models/iot-data.model';
import * as L from 'leaflet';

@Component({
  selector: 'app-route-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './route-detail.component.html',
  styleUrls: ['./route-detail.component.scss']
})
export class RouteDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapRef') mapRef!: ElementRef;

  routeId!: number;
  routeData: IotData[] = [];
  loading = false;
  error = '';
  private map!: L.Map;
  private markers: L.CircleMarker[] = [];

  readonly legendItems = [
    { range: '≤ 0.05', color: '#00FF00', label: 'Minimum Background' },
    { range: '0.06-0.09', color: '#80FF00', label: 'Very Low' },
    { range: '0.10-0.13', color: '#FFFF00', label: 'Normal Background' },
    { range: '0.14-0.19', color: '#FFBF00', label: 'Elevated' },
    { range: '0.20-0.25', color: '#FF7F00', label: 'Moderate' },
    { range: '0.26-0.29', color: '#FF0000', label: 'High' },
    { range: '0.30-0.35', color: '#BF0000', label: 'Very High' },
    { range: '0.36-0.41', color: '#400080', label: 'Extreme' },
    { range: '0.42-0.47', color: '#A000A0', label: 'Severe' },
    { range: '> 0.47', color: '#FF00FF', label: 'Dangerous' }
  ];

  constructor(
    private route: ActivatedRoute,
    private routeService: RouteService
  ) { }

  ngOnInit(): void {
    this.routeId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadRouteData();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initMap();
      if (this.routeData.length > 0) {
        this.updateMapWithData();
      }
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    if (!this.mapRef?.nativeElement) {
      console.error('Map reference not found');
      return;
    }

    try {
      this.map = L.map(this.mapRef.nativeElement).setView([0, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);
    } catch (error) {
      console.error('Error initializing map:', error);
      this.error = 'Failed to initialize map';
    }
  }

  private loadRouteData(): void {
    if (!this.routeId) return;

    this.loading = true;
    this.routeService.getRouteData(this.routeId).subscribe({
      next: (data) => {
        this.routeData = data;
        this.loading = false;
        this.updateMapWithData();
      },
      error: (err) => {
        this.error = 'Failed to load route data';
        this.loading = false;
        console.error('Error loading route data:', err);
      }
    });
  }

  private updateMapWithData(): void {
    if (!this.map || !this.routeData.length) return;

    // Clear existing markers
    this.markers.forEach(marker => marker.remove());
    this.markers = [];

    // Create markers and path coordinates
    const coordinates: L.LatLng[] = [];

    this.routeData.forEach(point => {
      const latLng = L.latLng(point.latitude, point.longitude);
      coordinates.push(latLng);

      // Create marker with color based on USV value
      const marker = L.circleMarker(latLng, {
        radius: 8,
        fillColor: this.getColorForUsv(point.usvPerHour),
        color: '#000',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
      });

      // Add popup with data
      marker.bindPopup(`
        <strong>USV/Hour:</strong> ${point.usvPerHour}<br>
        <strong>Location:</strong> ${point.latitude}, ${point.longitude}
      `);

      marker.addTo(this.map);
      this.markers.push(marker);
    });

    // Create path line connecting all points
    if (coordinates.length > 0) {
      L.polyline(coordinates, {
        color: '#0066cc',
        weight: 3,
        opacity: 0.6
      }).addTo(this.map);

      // Fit map bounds to show all markers
      this.map.fitBounds(L.latLngBounds(coordinates));
    }
  }

  private getColorForUsv(usv: number): string {
    // Define radiation thresholds (µSv/h) with very granular steps
    const levels = [
      { threshold: 0.05, color: '#00FF00' },    // Bright Green - Minimum
      { threshold: 0.07, color: '#40FF00' },    // Green variants
      { threshold: 0.09, color: '#80FF00' },
      { threshold: 0.11, color: '#BFFF00' },
      { threshold: 0.13, color: '#FFFF00' },    // Yellow - Around average
      { threshold: 0.15, color: '#FFDF00' },    // Yellow-Orange variants
      { threshold: 0.17, color: '#FFBF00' },
      { threshold: 0.19, color: '#FF9F00' },
      { threshold: 0.21, color: '#FF7F00' },    // Orange variants
      { threshold: 0.23, color: '#FF5F00' },
      { threshold: 0.25, color: '#FF3F00' },
      { threshold: 0.27, color: '#FF1F00' },
      { threshold: 0.29, color: '#FF0000' },    // Red variants
      { threshold: 0.31, color: '#DF0000' },
      { threshold: 0.33, color: '#BF0000' },
      { threshold: 0.35, color: '#9F0000' },
      { threshold: 0.37, color: '#7F0000' },    // Dark Red variants
      { threshold: 0.39, color: '#5F0000' },
      { threshold: 0.41, color: '#400080' },    // Purple variants - Above maximum
      { threshold: 0.43, color: '#600080' },
      { threshold: 0.45, color: '#800080' },
      { threshold: 0.47, color: '#A000A0' },    // Bright Purple - Extreme
      { threshold: 0.49, color: '#C000C0' },
      { threshold: Infinity, color: '#FF00FF' }  // Magenta - Danger
    ];

    // Find the appropriate color based on the USV value
    for (const level of levels) {
      if (usv <= level.threshold) {
        return level.color;
      }
    }

    return levels[levels.length - 1].color; // Return the highest danger color if above all thresholds
  }
}