import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-change-in-production';

export interface TokenPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function generateToken(
  payload: TokenPayload,
  expiresIn: jwt.SignOptions['expiresIn'] = '7d' // Default: 7 days
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}






