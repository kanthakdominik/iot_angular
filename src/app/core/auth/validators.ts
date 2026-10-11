import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, USERNAME_PATTERN } from '../api/users.models';

const encoder = new TextEncoder();

/**
 * New password: 10+ characters and at most 72 UTF-8 bytes (the BCrypt limit enforced by the backend).
 * Errors: `passwordTooShort: { min }`, `passwordTooLong: { max }` – messages `auth.password.tooShort` / `tooLong`.
 */
export const passwordValidator: ValidatorFn = (control: AbstractControl<string | null>): ValidationErrors | null => {
  const value = control.value ?? '';
  if (!value) {
    return null;
  }
  if (value.length < PASSWORD_MIN_LENGTH) {
    return { passwordTooShort: { min: PASSWORD_MIN_LENGTH } };
  }
  if (encoder.encode(value).length > PASSWORD_MAX_BYTES) {
    return { passwordTooLong: { max: PASSWORD_MAX_BYTES } };
  }
  return null;
};

/** `^[A-Za-z0-9._-]{3,50}$`; error `pattern` – message `auth.username.invalid`. */
export const usernameValidator: ValidatorFn = Validators.pattern(USERNAME_PATTERN);
