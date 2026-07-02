import { NextResponse } from 'next/server'

export async function GET() {
  const cronSecret = process.env.CRON_SECRET || 'your-cron-secret'
  const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'

  try {
    const response = await fetch(`${backendUrl}/api/cron/reconcile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    return NextResponse.json({ error: 'proxy_failed', message: error.message }, { status: 500 })
  }
}

export async function POST() {
  return GET()
}
export const dynamic = 'force-dynamic'
