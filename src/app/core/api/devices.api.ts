import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DeviceCommand, DeviceDto, HealthPoint, HealthQuery, ImportResult } from './devices.models';
import { API_URL, ApiOptions, apiContext, toParams } from './http';

/** `/api/devices` (V2.1-SPEC §3.3). Mutations require ADMIN. */
@Injectable({ providedIn: 'root' })
export class DevicesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/devices`;

  list(options?: ApiOptions): Observable<DeviceDto[]> {
    return this.http.get<DeviceDto[]>(this.url, { context: apiContext(options) });
  }

  get(id: string, options?: ApiOptions): Observable<DeviceDto> {
    return this.http.get<DeviceDto>(`${this.url}/${encodeURIComponent(id)}`, { context: apiContext(options) });
  }

  rename(id: string, name: string, options?: ApiOptions): Observable<DeviceDto> {
    return this.http.patch<DeviceDto>(`${this.url}/${encodeURIComponent(id)}`, { name },
      { context: apiContext(options) });
  }

  /** 202 Accepted; 503 when MQTT is unavailable. */
  command(id: string, cmd: DeviceCommand, options?: ApiOptions): Observable<void> {
    return this.http.post<void>(`${this.url}/${encodeURIComponent(id)}/commands`, { cmd },
      { context: apiContext(options) });
  }

  /** Battery and GSM history, ascending. */
  health(id: string, query: HealthQuery = {}, options?: ApiOptions): Observable<HealthPoint[]> {
    return this.http.get<HealthPoint[]>(`${this.url}/${encodeURIComponent(id)}/health`,
      { params: toParams(query), context: apiContext(options) });
  }

  /** Uploads 1–20 `r<N>.jsonl` / `.txt` files saved offline on the SD card (≤ 50 MB in total). */
  import(id: string, files: readonly File[], options?: ApiOptions): Observable<ImportResult> {
    const body = new FormData();
    for (const file of files) {
      body.append('files', file, file.name);
    }
    return this.http.post<ImportResult>(`${this.url}/${encodeURIComponent(id)}/import`, body,
      { context: apiContext(options) });
  }
}
