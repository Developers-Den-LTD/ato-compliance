import jwt from 'jsonwebtoken';
import { authConfig } from '../config/auth.config';
import { TokenPayload } from '../types/auth.types';

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, authConfig.jwt.accessTokenSecret, {
    expiresIn: authConfig.jwt.accessTokenExpiry as string,
  } as jwt.SignOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, authConfig.jwt.refreshTokenSecret, {
    expiresIn: authConfig.jwt.refreshTokenExpiry as string,
  } as jwt.SignOptions);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, authConfig.jwt.accessTokenSecret) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, authConfig.jwt.refreshTokenSecret) as TokenPayload;
};
