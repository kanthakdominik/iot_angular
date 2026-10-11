import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
    selector: 'app-confirm-dialog',
    standalone: true,
    imports: [],
    templateUrl: './confirm-dialog.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./confirm-dialog.component.scss']
})
export class ConfirmDialogComponent {
    @Input() title = 'Confirm action';
    @Input() message = 'Are you sure?';
    @Input() confirmLabel = 'Delete';
    @Input() confirmClass = 'btn-danger';

    constructor(public modal: NgbActiveModal) { }
}
