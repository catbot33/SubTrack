import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import type { Request, Response, NextFunction } from 'express';
import prisma from './db.ts';

dotenv.config();

// defining the userprofile structure all over the project for type safety

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: 'google';
  gmailAccessToken?: string;
  gmailRefreshToken?: string;
}
// defining the jwt payload structure all over the project for type safety and extending the userprofile structure to include iat and exp fields for token expiration and issued at time

export interface JWTPayload extends UserProfile {
  iat?: number;
  exp?: number;
}
// globally the EXPRESS.USER interface is extended to include the JWTPayload structure for type safety in the request object
declare global {
  namespace Express {
    interface User extends JWTPayload {}
  }
}

// 90 Days in Seconds: 90 days * 24 hrs * 60 mins * 60 secs = 7,776,000s (3 months)
export const SESSION_EXPIRY_STRING = '90d';
export const SESSION_EXPIRY_SECONDS = 90 * 24 * 60 * 60; // 7,776,000 seconds
export const SESSION_EXPIRY_MS = SESSION_EXPIRY_SECONDS * 1000; // 7,776,000,000 ms

// extracting secret and other sensitive information from environment variables for security reasons
const JWT_SECRET = process.env.JWT_SECRET;
const REDIRECT_URI_BASE = process.env.REDIRECT_URI_BASE || 'http://localhost:3500';
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || `${REDIRECT_URI_BASE}/auth/google/callback`;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

function getJwtSecret(): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured before creating or verifying sessions.');
  }

  return JWT_SECRET;
}

// configuring passport to use the Google OAuth strategy for authentication
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_REDIRECT_URI,
        passReqToCallback: true,
      },
      async (req: Request, accessToken, refreshToken, profile, done) => {
        const user: UserProfile = {
          id: profile.id,
          email: profile.emails?.[0]?.value || '',
          name: profile.displayName || profile.name?.givenName || 'Google User',
          avatar: profile.photos?.[0]?.value,
          provider: 'google',
          gmailAccessToken: accessToken,
          gmailRefreshToken: refreshToken || undefined,
        };

        try {
          const isGmailConnection = req.cookies?.oauth_intent === 'gmail_connect';
          // Upsert: create the user on first login, update name/avatar on subsequent logins
          if (!isGmailConnection) {
            await prisma.user.upsert({
              where: { email: user.email },
              update: { name: user.name, avatar: user.avatar },
              create: {
                email: user.email, name: user.name, avatar: user.avatar,
                provider: user.provider, providerId: user.id,
              },
            });
          }
        } catch (dbError) {
          console.error('[Auth] Failed to upsert user in database:', dbError);
          // Do NOT block login if DB write fails — degrade gracefully
        }

        return done(null, user);
      }
    )
  );
}

// Token formation for user
export function generateSessionToken(user: UserProfile): string {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    provider: user.provider,
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: SESSION_EXPIRY_STRING,
  });
}

// Token verification for user
export function verifySessionToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (typeof decoded === 'string') {
      return null;
    }

    return decoded as JWTPayload;
  } catch (error) {
    return null;
  }
}


// Middleware to authenticate JWT from either HttpOnly cookie or Authorization header Sends back the user profile in the request object if the token is valid, otherwise sends a 401 Unauthorized response

export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined = undefined;

  // 1. Try reading from HttpOnly cookie
  if (req.cookies && req.cookies.session_token) {
    token = req.cookies.session_token;
  }
  // 2. Try reading from Authorization Header (Bearer token)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'No session token provided' });
    return;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session token' });
    return;
  }

  req.user = payload;
  next();
}


export { passport };


