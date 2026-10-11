import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Group validator: the `confirm` control must equal the `password` control. Sets `mismatch` on the confirm control
 * (so `mat-error` shows under it) and removes it again once they match.
 */
export function passwordsMatch(password = 'password', confirm = 'confirm'): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const first = group.get(password);
    const second = group.get(confirm);
    if (!first || !second) {
      return null;
    }
    const mismatch = !!second.value && first.value !== second.value;
    const errors = { ...(second.errors ?? {}) };
    if (mismatch) {
      errors['mismatch'] = true;
    } else {
      delete errors['mismatch'];
    }
    second.setErrors(Object.keys(errors).length ? errors : null, { emitEvent: false });
    return mismatch ? { mismatch: true } : null;
  };
}
