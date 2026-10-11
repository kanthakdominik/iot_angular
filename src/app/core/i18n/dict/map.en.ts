import { DictShape } from '../i18n.types';
import type { mapPl } from './map.pl';

export const mapEn: DictShape<typeof mapPl> = {
  title: 'Map',
  legend: 'Legend',
  heatmap: 'Heat map',
  track: 'Track',
  layers: {
    osm: 'Map (OSM)',
    satellite: 'Satellite',
    topo: 'Topographic',
    dark: 'Dark',
  },
  fullscreen: {
    enter: 'Full screen',
    exit: 'Exit full screen',
  },
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  grid: {
    label: 'Map of all measurements. Hover over or tap a square to see its values.',
    dateRange: 'Date range',
    dateFrom: 'From',
    dateTo: 'To',
    device: 'Device',
    allDevices: 'All devices',
    clearFilters: 'Clear filters',
    metric: 'Square colour',
    avg: 'Average',
    max: 'Maximum',
    samples: 'Samples',
    cells: '{count, plural, =0 {No squares} one {# square} other {# squares}}',
    cellSize: 'side ≈ {size}',
    truncated: 'Showing the 10,000 squares with the most samples – zoom in to see the rest.',
    empty: 'No measurements in this area',
    emptyText: 'Pan or zoom out to find places with measurements.',
    emptyFiltered: 'Pan the map, or change the date range or device.',
    failed: 'Could not load the map',
  },
};
