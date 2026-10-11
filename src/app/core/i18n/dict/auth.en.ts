import { DictShape } from '../i18n.types';
import type { authPl } from './auth.pl';

export const authEn: DictShape<typeof authPl> = {
  login: {
    title: 'Sign in',
    heading: 'Sign in',
    intro: 'Only accounts created by an administrator have access.',
    username: 'Username',
    password: 'Password',
    submit: 'Sign in',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    usernameRequired: 'Enter your username',
    passwordRequired: 'Enter your password',
    invalidCredentials: 'Wrong username or password',
    tooManyAttempts: 'Too many failed attempts. Wait a quarter of an hour and try again.',
    network: 'Cannot reach the server. Check your connection and try again.',
    sharedHint: 'Links to shared routes open without signing in.',
    illustration: 'Measurement track over contour lines',
  },
  password: {
    current: 'Current password',
    new: 'New password',
    repeat: 'Repeat new password',
    tooShort: 'The password must have at least {min} characters',
    tooLong: 'The password is too long (max. {max} bytes)',
    mismatch: 'The passwords do not match',
    wrongCurrent: 'The current password is wrong',
    changed: 'Password changed',
  },
  username: {
    invalid: '3–50 characters: letters, digits, dot, underscore or hyphen',
  },
  loggedOut: 'Signed out',
};
