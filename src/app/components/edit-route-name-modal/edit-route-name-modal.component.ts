import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../services/api.service';

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

  readonly NAME_MIN_LENGTH = 3;
  readonly NAME_MAX_LENGTH = 50;
  readonly NAME_PATTERN = /^[a-zA-Z0-9\s\-_.,()]+$/;

  constructor(
    public activeModal: NgbActiveModal,
    private apiService: ApiService
  ) { }

  ngOnInit(): void {
    this.newName = this.currentName;
  }

  onSave(): void {
    if (this.loading) return;

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
    this.error = '';

    this.apiService.updateRouteName(this.routeId, name).subscribe({
      next: () => {
        this.activeModal.close(name);
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.message || 'Failed to rename the route';
      }
    });
  }

  private isValidRouteName(name: string): boolean {
    if (!name) {
      this.error = 'Route name is required';
      return false;
    }

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