import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';

  // Only intercept requests to the root homepage (/)
  if (url.pathname === '/') {
    // If the custom domain is the merchant domain
    if (hostname.includes('merchant-bantayog') || hostname.includes('merchant')) {
      url.pathname = '/merchant-login';
      return NextResponse.redirect(url);
    }
    
    // If the custom domain is the balance checker domain
    if (hostname.includes('balance-bantayog') || hostname.includes('balance')) {
      url.pathname = '/balance';
      return NextResponse.redirect(url);
    }

    // Otherwise (admin-bantayog.vercel.app or localhost), let it fall through
    // to the default page.tsx which automatically redirects to the Admin /login
  }
  
  return NextResponse.next();
}

// We only need this middleware to run on the root path
export const config = {
  matcher: '/',
};
