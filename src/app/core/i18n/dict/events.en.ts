import { DictShape } from '../i18n.types';
import type { eventsPl } from './events.pl';

export const eventsEn: DictShape<typeof eventsPl> = {
  title: 'Events',
  heading: 'Event log',
  total: '{count, plural, =0 {No entries} one {# entry} other {# entries}}',
  listLabel: 'Events, newest first',
  empty: 'No events',
  emptyText: 'Device connections, new routes, battery reports, commands, alerts and imports will show up here.',
  emptyFiltered: 'No events match the filters',
  newEvent: 'New event: {type}. {message}',
  routeLink: 'Route {id}',
  filters: {
    device: 'Device',
    allDevices: 'All devices',
    type: 'Event type',
    clear: 'Clear filters',
  },
  types: {
    DEVICE_ONLINE: 'Device online',
    DEVICE_OFFLINE: 'Device offline',
    ROUTE_STARTED: 'Route started',
    BATTERY: 'Battery',
    DEVICE_ERROR: 'Device error',
    MARKER: 'Marker',
    COMMAND_SENT: 'Command',
    ALERT: 'Alert',
    IMPORT: 'SD card import',
  },
  severity: {
    INFO: 'Info',
    WARN: 'Warning',
    ERROR: 'Error',
  },
};
