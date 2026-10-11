/**
 * The service worker itself is @angular/service-worker (provideServiceWorker in app.config.ts, ngsw-config.json).
 * On logout the cached API responses (ngsw "dataGroups" caches) are dropped, so the next user of the device does not
 * see them offline.
 */
export async function clearApiCache(): Promise<void> {
  if (typeof caches === 'undefined') {
    return;
  }
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('ngsw:') && key.includes(':data:')).map(key => caches.delete(key)));
  } catch {
    // Cache Storage unavailable (private mode) – nothing cached either
  }
}
