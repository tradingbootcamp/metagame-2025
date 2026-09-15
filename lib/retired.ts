import { NextResponse } from 'next/server'

/** 410 Gone for an entry point kept in tree but switched off by INTEGRATIONS_RETIRED. */
export function retiredResponse(what: string) {
  return NextResponse.json(
    { error: `${what} has been retired` },
    { status: 410 },
  )
}
