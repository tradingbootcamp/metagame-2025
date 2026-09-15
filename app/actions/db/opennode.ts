'use server'

import { opennodeDbService } from '@/lib/db/opennode'
import { getOpenNode } from '@/lib/opennode'

import { INTEGRATIONS_RETIRED } from '@/config/retired'

/** Deliberately public: the checkout status page polls this before the
 * purchaser has an account, and the unguessable orderId scopes the lookup. */
export async function getOrderStatus({ orderId }: { orderId: string }) {
  if (INTEGRATIONS_RETIRED) {
    return { orderId, retired: true as const }
  }

  // Get our internal DB record for this order
  const dbCharge = await opennodeDbService.getChargeByOrderId({ orderId })
  if (!dbCharge) {
    throw new Error('Order not found')
  }

  // Fetch current status from OpenNode
  const openNodeId = dbCharge.opennode_order_id
  const remote = await getOpenNode().chargeInfo(openNodeId)

  return {
    orderId,
    retired: false as const,
    status: remote.status || dbCharge.status,
    amount: remote.amount,
    opennodeId: remote.id,
    purchaserEmail: dbCharge.purchaser_email,
    ticketType: dbCharge.ticket_type,
    hostedUrl: `https://checkout.opennode.com/${remote.id}`,
  }
}
