import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isBlockedFinancialPath } from '@/lib/financial-product';

export function proxy(request: NextRequest) {
  if (!isBlockedFinancialPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  return new NextResponse(null, { status: 404, statusText: 'Not Found' });
}

export const config = {
  matcher: [
    '/b2b/dashboard',
    '/b2b/dashboard/:path*',
    '/b2b/deposit',
    '/b2b/deposit/:path*',
    '/b2b/withdraw',
    '/b2b/withdraw/:path*',
    '/deposit',
    '/deposit/:path*',
    '/withdraw',
    '/withdraw/:path*',
    '/deposito',
    '/deposito/:path*',
    '/saque',
    '/saque/:path*',
    '/family/deposito',
    '/family/deposito/:path*',
    '/family/saque',
    '/family/saque/:path*',
  ],
};
