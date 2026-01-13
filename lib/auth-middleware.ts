import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { verifyToken } from './jwt';

export async function requireAuth(request: NextRequest) {
  // Check for bearer token first
  const authHeader = request.headers.get('authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (decoded) {
      // Token is valid, attach user info to request
      (request as any).user = decoded;
      return null; // Authenticated via bearer token
    }
  }

  // Fall back to session-based auth
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized - Authentication required' },
      { status: 401 }
    );
  }

  // Attach user info to request
  (request as any).user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };

  return null; // Return null if authenticated (no error)
}

export async function getAuthUser(request: NextRequest) {
  // Check bearer token first
  const authHeader = request.headers.get('authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded) {
      return decoded;
    }
  }

  // Fall back to session
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    };
  }

  return null;
}
