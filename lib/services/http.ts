import { NextResponse } from 'next/server';
import { ServiceError } from './errors';

/** JSON error response for API routes, keeping the { success: false, error } shape the pages expect. */
export function errorResponse(error: any, context: string, fallbackMessage: string) {
  if (error instanceof ServiceError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error(`${context} error:`, error);
  return NextResponse.json(
    { success: false, error: error?.message || fallbackMessage },
    { status: 500 }
  );
}

export function unauthorized() {
  return NextResponse.json(
    { success: false, error: 'Unauthorized - User not found' },
    { status: 401 }
  );
}
