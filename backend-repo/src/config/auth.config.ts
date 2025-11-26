export const authConfig = {
  jwt: {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'your-access-token-secret-change-in-production',
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-token-secret-change-in-production',
    accessTokenExpiry: '15m', // 15 minutes
    refreshTokenExpiry: '7d', // 7 days
  },
  bcrypt: {
    saltRounds: 10,
  },
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Only HTTPS in production
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
};
