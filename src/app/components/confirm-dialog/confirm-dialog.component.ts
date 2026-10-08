import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
    selector: 'app-confirm-dialog',
    standalone: true,
    imports: [],
    templateUrl: './confirm-dialog.component.html',
    styleUrls: ['./confirm-dialog.component.scss']
})
export class ConfirmDialogComponent {
    @Input() title = 'Confirm action';
    @Input() message = 'Are you sure?';
    @Input() confirmLabel = 'Delete';
    @Input() confirmClass = 'btn-danger';

    constructor(public modal: NgbActiveModal) { }
}
