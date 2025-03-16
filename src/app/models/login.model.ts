export interface Login {
    username: string;
    password: string;
}

export interface LoginResponse {
    message: string;
    username: string;
    sessionId: string;
} 