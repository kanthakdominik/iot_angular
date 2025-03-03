import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
    selector: 'app-edit-route-name-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './edit-route-name-modal.component.html',
    styleUrls: ['./edit-route-name-modal.component.scss']
})
export class EditRouteNameModalComponent {
    @Input() currentName: string = '';
    @Output() save = new EventEmitter<string>();
    @Output() cancel = new EventEmitter<void>();

    newName: string = '';
    error: string = '';

    constructor(public activeModal: NgbActiveModal) {}

    ngOnInit() {
        this.newName = this.currentName;
    }

    onSave() {
        const trimmedName = this.newName.trim();
        if (this.isValidRouteName(trimmedName)) {
            this.save.emit(trimmedName);
        }
    }

    onCancel() {
        this.cancel.emit();
    }

    private isValidRouteName(name: string): boolean {
        if (name.length < 3 || name.length > 50) {
            this.error = 'Route name must be between 3 and 50 characters';
            return false;
        }

        const validNameRegex = /^[a-zA-Z0-9\s\-_.,()]+$/;
        if (!validNameRegex.test(name)) {
            this.error = 'Route name can only contain letters, numbers, spaces, and basic punctuation';
            return false;
        }

        this.error = '';
        return true;
    }
}