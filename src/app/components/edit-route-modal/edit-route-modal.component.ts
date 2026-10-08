import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ApiService } from '../../services/api.service';
import { Route } from '../../models/route.model';

/** Edits name and description of a route. Saves itself and closes with the updated route. */
@Component({
  selector: 'app-edit-route-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="modal-header">
      <h4 class="modal-title">Edit route</h4>
      <button type="button" class="btn-close" aria-label="Close" (click)="activeModal.dismiss()" [disabled]="saving"></button>
    </div>
    <div class="modal-body">
      <div class="mb-3">
        <label class="form-label" for="route-name">Name</label>
        <input id="route-name" type="text" class="form-control" [(ngModel)]="name" maxlength="100"
               [disabled]="saving" (keyup.escape)="activeModal.dismiss()">
      </div>
      <div class="mb-1">
        <label class="form-label" for="route-description">Description</label>
        <textarea id="route-description" class="form-control" rows="4" [(ngModel)]="description" maxlength="2000"
                  [disabled]="saving" placeholder="Where, how, with what source, weather..."></textarea>
      </div>
      @if (error) {
        <div class="alert alert-danger mt-2">{{ error }}</div>
      }
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss()" [disabled]="saving">Cancel</button>
      <button type="button" class="btn btn-primary" (click)="save()" [disabled]="saving">
        @if (saving) {
          <span class="spinner-border spinner-border-sm me-1"></span>
        }
        Save
      </button>
    </div>
  `
})
export class EditRouteModalComponent implements OnInit {
  @Input({ required: true }) route!: Route;

  name = '';
  description = '';
  error = '';
  saving = false;

  constructor(public activeModal: NgbActiveModal, private apiService: ApiService) { }

  ngOnInit(): void {
    this.name = this.route.name;
    this.description = this.route.description ?? '';
  }

  save(): void {
    const name = this.name.trim();
    if (name.length < 1 || name.length > 100) {
      this.error = 'Name must have 1 to 100 characters';
      return;
    }
    this.saving = true;
    this.error = '';
    this.apiService.updateRoute(this.route.id, { name, description: this.description.trim() }).subscribe({
      next: updated => this.activeModal.close(updated),
      error: () => {
        this.saving = false;
        this.error = 'Failed to save the route';
      }
    });
  }
}
