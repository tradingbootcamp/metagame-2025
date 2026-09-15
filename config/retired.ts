/**
 * Post-event kill switch. The OpenNode/BTC checkout, Resend email, and the
 * waitlist-repair cron were retired after Metagame 2025 and their secrets
 * removed from Vercel. Their code stays in tree behind this flag.
 *
 * To re-enable: set this to false, restore OPENNODE_KEY, OPENNODE_ENV,
 * NEXT_PUBLIC_OPENNODE_ENV, RESEND_API_KEY, CRON_SECRET in Vercel, and restore
 * .github/workflows/repair-waitlists.yml (removed in the same PR as this file).
 */
export const INTEGRATIONS_RETIRED = true
