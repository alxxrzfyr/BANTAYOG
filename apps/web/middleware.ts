import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';

  // Only intercept requests to the root homepage (/)
  if (url.pathname === '/') {
    // If the custom domain contains "merchant" (e.g., merchant.bantayog.com)
    if (hostname.includes('merchant')) {
      url.pathname = '/merchant-login';
      return NextResponse.redirect(url);
    }
    
    // If the custom domain contains "balance" (e.g., balance.bantayog.com)
    if (hostname.includes('balance')) {
      url.pathname = '/balance';
      return NextResponse.redirect(url);
    }

    // Otherwise (admin.bantayog.com or localhost), let it fall through to the default 
    // page.tsx which automatically redirects to the Admin /login
  }
  
  return NextResponse.next();
}

// We only need this middleware to run on the root path
export const config = {
  matcher: '/',
};
