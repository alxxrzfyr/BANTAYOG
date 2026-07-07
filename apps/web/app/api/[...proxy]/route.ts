import { NextRequest } from 'next/server';

export const runtime = 'edge';

let API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || "https://bantayogserver-production.up.railway.app";
if (!API_BASE_URL.startsWith("http://") && !API_BASE_URL.startsWith("https://")) {
  API_BASE_URL = "https://" + API_BASE_URL;
}

async function proxyRequest(req: NextRequest) {
  const url = new URL(req.url);
  
  // Construct the target URL. 
  // e.g. /api/beneficiaries -> https://bantayogserver.../api/beneficiaries
  const targetUrl = new URL(url.pathname + url.search, API_BASE_URL);
  console.log("PROXYING TO:", targetUrl.href);

  // Forward essential headers
  const headers = new Headers();
  if (req.headers.has('authorization')) headers.set('authorization', req.headers.get('authorization')!);
  if (req.headers.has('content-type')) headers.set('content-type', req.headers.get('content-type')!);
  
  // Forward the request
  const fetchOptions: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
    fetchOptions.body = req.body;
    // Next.js edge runtime requires duplex: 'half' when forwarding streams
    (fetchOptions as any).duplex = 'half';
  }

  const response = await fetch(targetUrl, fetchOptions);

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
