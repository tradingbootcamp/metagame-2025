import { NextRequest, NextResponse } from 'next/server'

import { apiError } from '@/lib/apiError'
import { sessionRsvpsService } from '@/lib/db/sessionRsvps'
import { retiredResponse } from '@/lib/retired'

import { INTEGRATIONS_RETIRED } from '@/config/retired'

export async function POST(request: NextRequest) {
  if (INTEGRATIONS_RETIRED) return retiredResponse('Waitlist repair cron')

  try {
    // Basic authentication check for cron job
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (!process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 500 },
      )
    }

    if (authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Run the repair function
    const results = await sessionRsvpsService.repairSessionWaitlists()

    const totalPromoted = results.reduce((sum, r) => sum + r.promoted.length, 0)

    return NextResponse.json({
      success: true,
      sessionsRepaired: results.length,
      totalUsersPromoted: totalPromoted,
      results: results.map((r) => ({
        sessionId: r.sessionId,
        type: r.type,
        promotedCount: r.promoted.length,
      })),
    })
  } catch (error) {
    return apiError(error, 'Failed to repair waitlists')
  }
}
