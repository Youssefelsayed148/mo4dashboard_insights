import { NextRequest, NextResponse } from 'next/server';
import { authorized, accessFailure } from './lib/access';
export function proxy(request: NextRequest) {
  if (!authorized(request.headers.get('authorization'))) return accessFailure();
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.svg).*)'] };
