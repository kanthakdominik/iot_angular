export interface Login {
  username: string;
  password: string;
}

/** Response of /api/auth/login and /api/auth/me. */
export interface UserInfo {
  username: string;
  role: string;
}
