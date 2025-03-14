import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { RouteService } from '../../services/api.service';

@Component({
  selector: 'app-edit-route-name-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-route-name-modal.component.html',
  styleUrls: ['./edit-route-name-modal.component.scss']
})
export class EditRouteNameModalComponent implements OnInit {
  @Input() currentName = '';
  @Input() routeId!: number;

  newName = '';
  error = '';
  loading = false;

  private readonly NAME_MIN_LENGTH = 3;
  private readonly NAME_MAX_LENGTH = 50;
  private readonly NAME_PATTERN = /^[a-zA-Z0-9\s\-_.,()]+$/;

  constructor(
    public activeModal: NgbActiveModal,
    private routeService: RouteService
  ) {}

  ngOnInit(): void {
    this.newName = this.currentName;
  }

  onSave(): void {
    const trimmedName = this.newName.trim();
    if (this.isValidRouteName(trimmedName)) {
      this.updateRouteName(trimmedName);
    }
  }

  onCancel(): void {
    this.activeModal.dismiss('cancel');
  }

  private updateRouteName(name: string): void {
    this.loading = true;
    this.routeService.updateRouteName(this.routeId, name).subscribe({
      next: () => {
        this.loading = false;
        this.activeModal.close(name);
      },
      error: () => {
        this.loading = false;
        this.error = 'Failed to rename the route';
      }
    });
  }

  private isValidRouteName(name: string): boolean {
    if (name.length < this.NAME_MIN_LENGTH || name.length > this.NAME_MAX_LENGTH) {
      this.error = `Route name must be between ${this.NAME_MIN_LENGTH} and ${this.NAME_MAX_LENGTH} characters`;
      return false;
    }

    if (!this.NAME_PATTERN.test(name)) {
      this.error = 'Route name can only contain letters, numbers, spaces, and basic punctuation';
      return false;
    }

    this.error = '';
    return true;
  }
}