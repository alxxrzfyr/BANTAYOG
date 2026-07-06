import { NextRequest } from 'next/server';

export const runtime = 'edge';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || "https://bantayogserver-production.up.railway.app";

async function proxyRequest(req: NextRequest) {
  const url = new URL(req.url);
  
  // Construct the target URL. 
  // e.g. /api/beneficiaries -> https://bantayogserver.../api/beneficiaries
  const targetUrl = new URL(url.pathname + url.search, API_BASE_URL);

  // Copy headers
  const headers = new Headers(req.headers);
  // Forward the host header to the target
  headers.set('host', targetUrl.host);
  
  // Forward the request
  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.blob() : undefined,
    redirect: 'manual',
  });

  // Return the response
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-encoding'); // Let Next.js handle encoding

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export async function GET(req: NextRequest) { return proxyRequest(req); }
export async function POST(req: NextRequest) { return proxyRequest(req); }
export async function PUT(req: NextRequest) { return proxyRequest(req); }
export async function PATCH(req: NextRequest) { return proxyRequest(req); }
export async function DELETE(req: NextRequest) { return proxyRequest(req); }
export async function OPTIONS(req: NextRequest) { return proxyRequest(req); }
