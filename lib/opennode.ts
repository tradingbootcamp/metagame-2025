import * as opennode from 'opennode'
import type {
  OpenNodeCharge,
  OpenNodeChargeRequest,
} from 'opennode/dist/types/v1'

function openNodeKey() {
  const key = process.env.OPENNODE_KEY
  if (!key) {
    throw new Error('OPENNODE_KEY is not set')
  }
  return key
}

function openNodeEnv() {
  return (process.env.OPENNODE_ENV ||
    process.env.NEXT_PUBLIC_OPENNODE_ENV ||
    'dev') as 'live' | 'dev'
}

let credentialsSet = false

/** Lazy so a missing OPENNODE_KEY only fails callers, not every route that
 * happens to share a module graph with this file. See config/retired.ts. */
export function getOpenNode() {
  if (!credentialsSet) {
    opennode.setCredentials(openNodeKey(), openNodeEnv())
    credentialsSet = true
  }
  return opennode
}

/** Raw fetch function so we can handle the opennode response/see errors better than with the SDK function */
export async function createChargeRaw(
  payload: OpenNodeChargeRequest,
): Promise<OpenNodeCharge> {
  const key = openNodeKey()
  const env = openNodeEnv()
  const base =
    env === 'live' ? 'https://api.opennode.com' : 'https://dev-api.opennode.com'

  // Basic debug info
  console.log('[OpenNode RAW] createCharge payload', {
    amount: payload.amount,
    hasCallback: Boolean(payload.callback_url),
    hasSuccess: Boolean(payload.success_url),
    order_id: payload.order_id,
  })

  const res = await fetch(`${base}/v1/charges`, {
    method: 'POST',
    headers: {
      Authorization: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // ignore JSON parse error, we'll use raw text below
  }

  if (!res.ok) {
    console.error('[OpenNode RAW] createCharge failed', {
      status: res.status,
      body: text?.slice(0, 1000),
    })
    throw new Error(
      `OpenNode createCharge failed (${res.status}): ${text?.slice(0, 500)}`,
    )
  }

  const data =
    json &&
    typeof json === 'object' &&
    'data' in (json as Record<string, unknown>)
      ? (json as Record<string, unknown>).data
      : json
  return data as OpenNodeCharge
}
