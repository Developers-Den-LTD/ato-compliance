import { Request } from 'express';

export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
}
