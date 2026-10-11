import { IsoInstant } from './http';

export type Role = 'ADMIN' | 'VIEWER';
export type ThemePref = 'system' | 'light' | 'dark';
export type Lang = 'pl' | 'en';
export type DoseUnit = 'uSv' | 'nSv' | 'uR';
export type MapLayerKey = 'osm' | 'satellite' | 'topo' | 'dark';

/** Allowed values; the first one is the default (same order as the backend). */
export const THEME_PREFS: readonly ThemePref[] = ['system', 'light', 'dark'];
export const LANGS: readonly Lang[] = ['pl', 'en'];
export const DOSE_UNITS: readonly DoseUnit[] = ['uSv', 'nSv', 'uR'];
export const MAP_LAYER_KEYS: readonly MapLayerKey[] = ['osm', 'satellite', 'topo', 'dark'];

export interface Preferences {
  readonly theme: ThemePref;
  readonly language: Lang;
  readonly doseUnit: DoseUnit;
  readonly mapLayer: MapLayerKey;
}

export interface UserInfo {
  readonly username: string;
  readonly role: Role;
  readonly preferences: Preferences;
}

export interface UserDto {
  readonly id: number;
  readonly username: string;
  readonly role: Role;
  readonly createdAt: IsoInstant;
}

export interface LoginRequest {
  readonly username: string;
  readonly password: string;
}

export interface PasswordChange {
  readonly currentPassword: string;
  readonly newPassword: string;
}

export interface UserCreate {
  readonly username: string;
  readonly password: string;
  readonly role: Role;
}

/** PATCH body: omitted = unchanged. */
export interface UserUpdate {
  readonly role?: Role;
  readonly password?: string;
}

/** `^[A-Za-z0-9._-]{3,50}$` – same rule as the backend. */
export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;
/** New passwords: at least 10 characters, at most 72 UTF-8 bytes (BCrypt limit). */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_BYTES = 72;
