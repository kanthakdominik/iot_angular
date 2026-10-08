import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subscription, switchMap, timer } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Device, DeviceCommand } from '../../models/device.model';
import { TextInputModalComponent } from '../text-input-modal/text-input-modal.component';

/** Measuring devices with their live status; admins can start a new route or read the battery remotely. */
@Component({
  selector: 'app-device-panel',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './device-panel.component.html',
  styleUrls: ['./device-panel.component.scss']
})
export class DevicePanelComponent implements OnInit, OnDestroy {
  @Input() isAdmin = false;
  /** Emitted after a command was accepted, e.g. to reload the route list. */
  @Output() commandSent = new EventEmitter<DeviceCommand>();

  devices: Device[] = [];
  message = '';
  error = '';
  private subscription?: Subscription;

  constructor(private apiService: ApiService, private modalService: NgbModal) { }

  ngOnInit(): void {
    // refresh every 30 s - online status, battery and current route change over time
    this.subscription = timer(0, 30_000).pipe(switchMap(() => this.apiService.getDevices())).subscribe({
      next: devices => this.devices = devices,
      error: () => this.error = 'Failed to load devices'
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  reload(): void {
    this.apiService.getDevices().subscribe(devices => this.devices = devices);
  }

  send(device: Device, cmd: DeviceCommand): void {
    this.message = '';
    this.error = '';
    this.apiService.sendCommand(device.id, cmd).subscribe({
      next: () => {
        this.message = cmd === 'new-route'
          ? `${device.name}: new route requested`
          : `${device.name}: battery reading requested`;
        this.commandSent.emit(cmd);
        // the device answers over MQTT within a few seconds
        setTimeout(() => this.reload(), 3000);
      },
      error: err => this.error = err.status === 503
        ? 'The server is not connected to the MQTT broker'
        : 'Failed to send the command'
    });
  }

  rename(device: Device): void {
    const modalRef = this.modalService.open(TextInputModalComponent);
    modalRef.componentInstance.title = 'Rename device';
    modalRef.componentInstance.label = `Name of ${device.id}`;
    modalRef.componentInstance.initialValue = device.name;
    modalRef.componentInstance.maxLength = 100;
    modalRef.result.then(
      (name: string) => this.apiService.renameDevice(device.id, name).subscribe({
        next: updated => device.name = updated.name,
        error: () => this.error = 'Failed to rename the device'
      }),
      () => void 0
    );
  }
}
