import { getSiteUrl } from './env'
import { Resend } from 'resend'

import { SOCIAL_LINKS } from '@/utils/urls'

import { INTEGRATIONS_RETIRED } from '@/config/retired'
import { ticketTypeDetails } from '@/config/tickets'
import { DbTicketType } from '@/types/database/dbTypeAliases'

let resendClient: Resend | null = null

/** Lazy: `new Resend(undefined)` throws "Missing API key" at construction, so a
 * module-scope client would break every route sharing this module graph. */
export function getResend() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

export interface TicketConfirmationEmailData {
  to: string
  purchaserName: string
  ticketType: DbTicketType
  ticketCode: string
  isBtc: boolean
  usdPaid?: number
  btcPaid?: number
  paymentIntentId?: string
  opennodeChargeId?: string
  adminIssued?: boolean
  forExistingUser?: boolean
  test?: boolean
}

export async function sendTicketConfirmationEmail({
  to,
  purchaserName,
  ticketType,
  ticketCode,
  isBtc,
  usdPaid = 0,
  btcPaid = 0,
  paymentIntentId,
  opennodeChargeId,
  adminIssued = false,
  forExistingUser = false,
  test = false,
}: TicketConfirmationEmailData) {
  if (INTEGRATIONS_RETIRED) {
    return { success: false as const, skipped: 'retired' as const, data: null }
  }
  try {
    const discordUrl = SOCIAL_LINKS.DISCORD
    const testSubject = test ? 'TEST: ' : ''
    const siteUrl = getSiteUrl()
    const pricePaid = isBtc
      ? `₿${btcPaid?.toFixed(6)}`
      : `$${usdPaid?.toFixed(2)}`
    const paymentIdLine = isBtc
      ? `- OpenNode Charge ID: ${opennodeChargeId}`
      : `- Stripe Payment ID: ${paymentIntentId}`
    const ticketCodeLine = `- Your Ticket Code: ${ticketCode} (you will need this to create your account and associate the ticket)`
    // Built as lines rather than inline conditionals so an omitted detail
    // doesn't leave a blank line (or a stray `false`) in the plaintext part.
    const textTicketDetails = [
      `- Ticket Type: ${ticketTypeDetails[ticketType].title}`,
      ...(adminIssued ? [] : [`- Price Paid: ${pricePaid}`]),
      ...(forExistingUser ? [] : [ticketCodeLine]),
      ...(adminIssued ? [] : [paymentIdLine]),
    ].join('\n')
    const textNextSteps = forExistingUser
      ? `Your account already exists and now has an associated ticket. If you haven't logged in before, you can set your password at ${siteUrl}/login/reset?email=${encodeURIComponent(to)}&firstLogin=true`
      : `Next Steps:
1. Go to ${siteUrl}/signup?email=${encodeURIComponent(to)}&ticketCode=${ticketCode}
2. Your email and ticket code will be pre-filled
3. Create your account and set up your profile (badge name, Discord, etc.)
4. Confirm your account by clicking the verification link sent to your email (required so ticket codes can be used with a different email if needed)

Note: The Ticket Code above allows you to create an account/register for the event. It can be used with any email address and name. To sign up with a different email address than this one, or to transfer this ticket to someone else, go to ${siteUrl}/signup?ticketCode=${ticketCode} and enter the appropriate details with your ticket code.`
    const { data, error } = await getResend().emails.send({
      from: 'Metagame 2025 <tickets@mail.metagame.games>',
      to,
      bcc: ['team@metagame.games'],
      replyTo: ['team@metagame.games'],
      subject: adminIssued
        ? `${testSubject}Actions required: Your Metagame 2025 ticket has been issued; claim your profile`
        : `${testSubject}Actions required: Claim your Metagame 2025 ticket and register your profile`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">${adminIssued ? 'Your ticket has been issued; please complete registration' : 'Claim your ticket and complete registration'}</h1>
          
          <p>Hi ${purchaserName || 'there'},</p>
          
          <p>Your Metagame 2025 ticket is confirmed. <strong>Next, claim your ticket and create your account</strong> so we can associate the ticket with your profile and keep you in the loop.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Ticket Details</h2>
            <p><strong>Ticket Type:</strong> ${ticketTypeDetails[ticketType].title}</p>
            ${adminIssued ? '' : `<p><strong>Price Paid:</strong> ${isBtc ? `₿${btcPaid?.toFixed(6)}` : `$${usdPaid?.toFixed(2)}`}</p>`}
            ${forExistingUser ? '' : `<p><strong>Your Ticket Code:</strong> <span style="font-size: 20px; font-weight: bold; color: #007bff;">${ticketCode}</span></p>`}
            ${adminIssued ? '' : isBtc ? `<p><strong>OpenNode Charge ID:</strong> ${opennodeChargeId}</p>` : `<p><strong>Stripe Payment ID:</strong> ${paymentIntentId}</p>`}
          </div>
          
          ${
            !forExistingUser
              ? `<div style="background-color: #e8f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">🎮 Next Steps</h3>
            <p>To claim your ticket and complete registration:</p>
            <ol>
              <li>Go to the <a href="${siteUrl}/signup?email=${encodeURIComponent(to)}&ticketCode=${ticketCode}">signup page</a></li>
              <li>Your email and ticket code will be pre-filled</li>
              <li>Create your account and set up your profile (badge name, Discord, etc.)</li>
              <li>Confirm your account by clicking the verification link sent to your email</li>
            </ol>
            <p> Note: The Ticket Code above allows you to create an account/register for the event. It can be used with <b>any</b> email address and name. To sign up with a different email address than this one, go to the <a href="${siteUrl}/signup?ticketCode=${ticketCode}">signup page</a> and enter the appropriate details with your ticket code. You can also effectively transfer this ticket to someone else by giving them the ticket code to sign up with.</p> 
          </div>`
              : `<div style="background-color: #e8f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">🎮 Next Steps</h3>
            <p>Your account already exists and now has an associated ticket. If you haven't logged in before, you can set your password at <a href="${siteUrl}/login/reset?email=${encodeURIComponent(to)}&firstLogin=true">this page</a>.</p>
          </div>`
          }

          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Event Information</h3>
            <p><strong>Dates:</strong> Friday, September 12 – Sunday, September 14, 2025</p>
            <p><strong>Location:</strong> Lighthaven Campus, 2740 Telegraph Avenue, Berkeley, CA</p>
            <p><strong>Lodging:</strong> Rooms at and near the venue can be booked via <a href="https://www.havenbookings.space/events/metagame">Haven Bookings</a>. You can also coordinate with others in the <a href="https://discord.gg/GsT3yRrxR9">#housing</a> Discord channel.</p>
            <p><strong>Food:</strong> Snacks are available and included with your ticket, but meals are not. There will be food trucks on site with meals available for purchase.</p>
            <p><strong>Schedule:</strong> A preliminary schedule is available <a href="https://metagame.games/schedule">here</a> but highly subject to chage.</p>
            <p><strong>Children:</strong> Metagame is free for children under 13, and free childcare for kids ages 5-12 is available for much of the weekend! If you are planning to bring children of any age or are a child yourself, please fill out <a href="https://airtable.com/appTvPARUssZp4qiB/pagZ9WbXLji0eBqDU/form">this form</a> as soon as possible, and no later than Monday, September 1st to help us plan accordingly.</p>
            <p><strong>Contact:</strong> <a href="${discordUrl}">Join our Discord!</a></p>
          </div>
          
          ${adminIssued ? '' : isBtc ? `<p>If you believe there has been a mistake, want a 94% refund on your ticket (available until September 1), reply to this email.</p>` : ''}
          
          <p>See you at Metagame 2025!</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ccc;">
          
          <p style="font-size: 12px; color: #666;">This is not a puzzle.</p>
        </div>
      `,
      text: `
${adminIssued ? 'Your ticket has been issued, please complete registration' : 'Claim your ticket and complete registration'}

Hi ${purchaserName || 'there'},

Your Metagame 2025 ticket is confirmed. NEXT: claim your ticket and create your account so we can associate the ticket with your profile and keep you in the loop.

Ticket Details:
${textTicketDetails}

${textNextSteps}

Please join the Discord, where all future communication will take place: ${discordUrl}
Housing at and near the venue can be booked via: https://www.havenbookings.space/events/metagame. Coordinate with others in the #housing Discord channel.

Event Information
- Name: Metagame 2025
- Dates: Friday, September 12 – Sunday, September 14, 2025
- Location: Lighthaven Campus, 2740 Telegraph Avenue, Berkeley, CA
- Contact: reply to this email

${adminIssued ? 'If you have any questions, just reply to this email.' : 'If you believe there has been a mistake, want a 94% refund on your ticket (available until September 1), or have any other questions, just reply to this email.'}

See you at Metagame 2025!

This is not a puzzle.
      `.trim(),
    })

    if (error) {
      console.error('Failed to send email:', error)
      throw error
    }

    return { success: true as const, skipped: null, data }
  } catch (error) {
    console.error('Error sending ticket confirmation email:', error)
    throw error
  }
}

/** Method so we can get notified of backend failures */
export const sendAdminErrorEmail = async (errorMessage: string) => {
  if (INTEGRATIONS_RETIRED) {
    return { success: false as const, skipped: 'retired' as const, data: null }
  }
  const { data, error } = await getResend().emails.send({
    from: 'Metagame 2025 <tickets@mail.metagame.games>',
    to: ['team@metagame.games'],
    subject: '**URGENT** METAGAME Admin Error',
    html: `<p>An error occurred: ${errorMessage}</p>`,
  })
  // Deliberately doesn't throw — callers reach for this while already handling
  // a failure, and the alerting path shouldn't become a second failure mode.
  if (error) {
    console.error('Failed to send admin error email:', error, errorMessage)
  }
  return { success: !error, skipped: null, data }
}
