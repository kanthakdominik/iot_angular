import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

/** Generic one-field dialog (marker label, device name). Closes with the trimmed text. */
@Component({
  selector: 'app-text-input-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="modal-header">
      <h4 class="modal-title">{{ title }}</h4>
      <button type="button" class="btn-close" aria-label="Close" (click)="activeModal.dismiss()"></button>
    </div>
    <div class="modal-body">
      <label class="form-label" for="text-input">{{ label }}</label>
      <input id="text-input" type="text" class="form-control" [(ngModel)]="value" [attr.maxlength]="maxLength"
             [placeholder]="placeholder" (keyup.enter)="save()" (keyup.escape)="activeModal.dismiss()">
      @if (error) {
        <div class="alert alert-danger mt-2">{{ error }}</div>
      }
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss()">Cancel</button>
      <button type="button" class="btn btn-primary" (click)="save()">Save</button>
    </div>
  `
})
export class TextInputModalComponent implements OnInit {
  @Input() title = 'Edit';
  @Input() label = '';
  @Input() initialValue = '';
  @Input() placeholder = '';
  @Input() maxLength = 200;

  value = '';
  error = '';

  constructor(public activeModal: NgbActiveModal) { }

  ngOnInit(): void {
    this.value = this.initialValue;
  }

  save(): void {
    const text = this.value.trim();
    if (!text) {
      this.error = 'Value cannot be empty';
      return;
    }
    this.activeModal.close(text);
  }
}
