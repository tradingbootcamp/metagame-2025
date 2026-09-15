'use client'

import { useMemo, useState } from 'react'

import { toast } from 'sonner'

import {
  type OpennodeChargeInput,
  opennodeChargeSchema,
} from '@/lib/schemas/opennode'

import { TICKET_TYPES } from '@/utils/dbUtils'
import { getHostedCheckoutUrl } from '@/utils/opennode'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { INTEGRATIONS_RETIRED } from '@/config/retired'
import { DbTicketType } from '@/types/database/dbTypeAliases'

type ChargeResponse = {
  charge: {
    id: string
    order_id: string
    amount: number
    status: string
  }
}

const BITCOIN_PRICE = 108500 // USD
export default function OpenNodeChargeTool({}: {
  searchParams?: Promise<Record<string, string | undefined>>
} = {}) {
  const [amountBtc, setAmountBtc] = useState<string>('0.001')
  const [ticketType, setTicketType] = useState<string>(TICKET_TYPES.PLAYER)
  const [purchaserEmail, setPurchaserEmail] = useState<string>('')
  const [purchaserName, setPurchaserName] = useState<string>('')
  const [isTest, setIsTest] = useState<boolean>(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const payload: OpennodeChargeInput | null = useMemo(() => {
    const amt = parseFloat(amountBtc)
    if (!Number.isFinite(amt)) return null
    return {
      amountBtc: amt,
      ticketDetails: {
        ticketType: ticketType as DbTicketType,
        isTest,
        purchaserEmail,
        purchaserName: purchaserName || undefined,
      },
    }
  }, [amountBtc, ticketType, purchaserEmail, purchaserName, isTest])

  const validationMessage = useMemo(() => {
    if (!payload) return 'Enter a valid BTC amount'
    const result = opennodeChargeSchema.safeParse(payload)
    if (!result.success) {
      const firstIssue = result.error.issues?.[0]
      return firstIssue?.message || 'Invalid input'
    }
    return null
  }, [payload])

  const isValid = !validationMessage

  const handleSubmit = async () => {
    setError(null)
    setSuccess(null)

    if (!payload) {
      setError('Please provide a valid amount')
      return
    }
    const parsed = opennodeChargeSchema.safeParse(payload)
    if (!parsed.success) {
      setError('Please fix validation errors before submitting')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/checkout/opennode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Request failed with ${res.status}`)
      }
      const data = (await res.json()) as ChargeResponse
      const hostedUrl = getHostedCheckoutUrl(data.charge.id)
      const btc = (data.charge.amount / 100_000_000).toFixed(6)
      const msg = `Created OpenNode charge. \nOrder: ${data.charge.order_id}, \nAmount: ₿${btc}, \nStatus: ${data.charge.status}. \nLink: ${hostedUrl}`
      setSuccess(msg)
      toast.success('OpenNode charge created')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to create charge'
      setError(message)
      toast.error('Failed to create charge')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {INTEGRATIONS_RETIRED && (
        <p className="text-sm text-amber-400">
          Retired: OpenNode checkout is disabled, see config/retired.ts
        </p>
      )}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="amountBtc">Amount (BTC) *</Label>
            <Input
              id="amountBtc"
              type="number"
              step="0.00000001"
              value={amountBtc}
              onChange={(e) => setAmountBtc(e.target.value)}
              placeholder="0.00000000"
            />
            <p className="text-sm text-gray-500">
              {`${(parseFloat(amountBtc) * BITCOIN_PRICE).toFixed(2)} USD`}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ticketType">Ticket Type *</Label>
            <Select value={ticketType} onValueChange={(v) => setTicketType(v)}>
              <SelectTrigger id="ticketType">
                <SelectValue placeholder="Select ticket type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TICKET_TYPES).map(([key, value]) => (
                  <SelectItem key={value} value={value}>
                    {key.charAt(0) + key.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="purchaserEmail">Purchaser Email *</Label>
            <Input
              id="purchaserEmail"
              type="email"
              value={purchaserEmail}
              onChange={(e) => setPurchaserEmail(e.target.value.trim())}
              placeholder="name@example.com"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="purchaserName">Purchaser Name</Label>
            <Input
              id="purchaserName"
              type="text"
              value={purchaserName}
              onChange={(e) => setPurchaserName(e.target.value)}
              placeholder="Optional display name"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="isTest"
            checked={isTest}
            onCheckedChange={(checked) => setIsTest(!!checked)}
          />
          <Label htmlFor="isTest">Mark as test</Label>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting || !isValid || INTEGRATIONS_RETIRED}
          className="w-full"
        >
          {submitting ? 'Creating Charge...' : 'Create OpenNode Charge'}
        </Button>

        {!isValid && validationMessage && (
          <p className="text-sm text-red-400">{validationMessage}</p>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-md border border-green-500/20 bg-green-500/10 p-4">
          <Textarea
            aria-label="Charge result"
            className="text-green-400"
            value={success}
            readOnly
          />
        </div>
      )}
    </div>
  )
}
