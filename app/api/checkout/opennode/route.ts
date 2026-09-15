import { NextRequest, NextResponse } from 'next/server'
import { OpenNodeCharge } from 'opennode/dist/types/v1'
import { v4 as uuidv4 } from 'uuid'

import { opennodeDbService } from '@/lib/db/opennode'
import { getResend } from '@/lib/email'
import { getSiteUrl } from '@/lib/env'
import { createChargeRaw } from '@/lib/opennode'
import { retiredResponse } from '@/lib/retired'
import {
  TicketPurchaseDetails,
  opennodeChargeSchema,
} from '@/lib/schemas/opennode'

import { getHostedCheckoutUrl } from '@/utils/opennode'
import { authLevelsToRanks, getCurrentUserAuthRank } from '@/utils/security'

import { INTEGRATIONS_RETIRED } from '@/config/retired'
import { btcSlidingScaleMinimum, ticketTypeDetails } from '@/config/tickets'
import { DbTicketType } from '@/types/database/dbTypeAliases'

const SATOSHIS_PER_BTC = 100_000_000
/** The one ticket type whose price the buyer picks. */
const BTC_SLIDING_SCALE_TICKET_TYPE: DbTicketType = 'player'

const btcToSatoshis = (btc: number) => Math.round(btc * SATOSHIS_PER_BTC)

export async function POST(req: NextRequest) {
  if (INTEGRATIONS_RETIRED) return retiredResponse('OpenNode checkout')

  // Public checkout is retired, so the admin charge tool is the only caller left
  const userIsAdmin =
    (await getCurrentUserAuthRank()) >= authLevelsToRanks.ADMIN
  if (!userIsAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = opennodeChargeSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid charge request' },
      { status: 400 },
    )
  }
  const { amountBtc, ticketDetails } = parsed.data
  const metagameOrderId = uuidv4()
  const callback = `${getSiteUrl()}/api/checkout/opennode/webhook`
  const successUrl = `${getSiteUrl()}/checkout/status/${metagameOrderId}`

  const ticketType = ticketTypeDetails[ticketDetails.ticketType]
  const ticketTitle = ticketType?.title || 'Unknown'
  const ticketPriceBtc = ticketType?.priceBTC

  // The charge amount is what the buyer actually has to pay for a real ticket, so
  // it comes from config, not from the request. The only exception is the sliding
  // scale type, where the buyer chooses — floored at the minimum.
  let amountSatoshis: number
  if (userIsAdmin) {
    const adminAmountBtc = amountBtc ?? ticketPriceBtc
    if (!adminAmountBtc) {
      return NextResponse.json(
        { error: 'No amount provided for this ticket type' },
        { status: 400 },
      )
    }
    amountSatoshis = btcToSatoshis(adminAmountBtc)
  } else if (!ticketPriceBtc) {
    return NextResponse.json(
      { error: 'Bitcoin payment is not available for this ticket type' },
      { status: 400 },
    )
  } else if (ticketDetails.ticketType === BTC_SLIDING_SCALE_TICKET_TYPE) {
    const requestedBtc = amountBtc ?? ticketPriceBtc
    if (requestedBtc < btcSlidingScaleMinimum) {
      return NextResponse.json(
        { error: 'Amount is below the sliding scale minimum' },
        { status: 400 },
      )
    }
    amountSatoshis = btcToSatoshis(requestedBtc)
  } else {
    amountSatoshis = btcToSatoshis(ticketPriceBtc)
  }

  // Only admins get to label an order as test data.
  const isTest = userIsAdmin
    ? (ticketDetails.isTest ?? false)
    : process.env.OPENNODE_ENV === 'dev'

  const charge = await createChargeRaw({
    amount: amountSatoshis,
    description: `Metagame ${ticketTitle} ticket for ${ticketDetails.purchaserEmail}`,
    customer_email: ticketDetails.purchaserEmail,
    auto_settle: true,
    order_id: metagameOrderId,
    callback_url: callback,
    success_url: successUrl,
  })

  await opennodeDbService.createCharge({ charge, ticketDetails, isTest })

  // Send email to purchaser with payment link
  try {
    await sendChargeCreationEmail(charge, ticketDetails)
  } catch (error) {
    console.error('Failed to send charge creation email:', error)
    // Don't fail the request if email fails
  }

  return NextResponse.json({ charge })
}

async function sendChargeCreationEmail(
  charge: OpenNodeCharge,
  ticketDetails: TicketPurchaseDetails,
) {
  const ticketTitle = ticketTypeDetails[ticketDetails.ticketType].title
  const amountBtc = (charge.amount / 100000000).toFixed(6)
  const hostedUrl = getHostedCheckoutUrl(charge.id)

  const { data, error } = await getResend().emails.send({
    from: 'Metagame 2025 <tickets@mail.metagame.games>',
    to: ticketDetails.purchaserEmail,
    bcc: ['team@metagame.games'],
    replyTo: ['team@metagame.games'],
    subject: 'Complete your Metagame 2025 ticket payment',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Complete your Metagame 2025 ticket payment</h1>
        
        <p>Hi ${ticketDetails.purchaserName || 'there'},</p>
        
        <p>Your Metagame 2025 ticket order has been created as an open Bitcoin transaction on OpenNode. Please complete your payment to get your ticket!</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin-top: 0;">Order Details</h2>
          <p><strong>Ticket Type:</strong> ${ticketTitle}</p>
          <p><strong>Amount:</strong> ₿${amountBtc}</p>
          <p><strong>Order ID:</strong> <a href="${getSiteUrl()}/checkout/status/${charge.order_id}">${charge.order_id}</a></p>
        </div>
        
        <div style="background-color: #e8f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Complete Payment</h3>
          <p>Click the button below to complete your Bitcoin payment:</p>
          <a href="${hostedUrl}" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Complete Payment</a>
          <p style="margin-top: 10px; font-size: 14px;">Or copy this link: <a href="${hostedUrl}">${hostedUrl}</a></p>
        </div>
        
        <p>After payment is complete, you'll receive a confirmation email with your ticket code and next steps.</p>
        
        <p>See you at Metagame 2025!</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ccc;">
        
        <p style="font-size: 12px; color: #666;">This is not a puzzle.</p>
      </div>
    `,
    text: `
Complete your Metagame 2025 ticket payment

Hi there,

Your Metagame 2025 ticket order has been created. Please complete your payment to secure your spot!

Order Details:
- Ticket Type: ${ticketTitle}
- Amount: ₿${amountBtc}
- Order ID: ${charge.order_id}

Complete Payment:
Click this link to complete your Bitcoin payment: ${hostedUrl}

After payment is complete, you'll receive a confirmation email with your ticket code and next steps.

See you at Metagame 2025!

This is not a puzzle.
    `.trim(),
  })

  // Resend reports API-level failures in the payload, not by rejecting.
  if (error) {
    throw error
  }
  return data
}
