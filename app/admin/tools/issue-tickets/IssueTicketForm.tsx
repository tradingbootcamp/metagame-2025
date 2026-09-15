'use client'

import { useEffect, useState } from 'react'

import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react'

import { TICKET_TYPES } from '@/utils/dbUtils'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import {
  AdminIssueTicketInput,
  adminIssueTicket,
} from '@/app/admin/tools/issue-tickets/actions'
import { ApiAllFullProfilesResponse } from '@/app/api/queries/profiles/route'

import { INTEGRATIONS_RETIRED } from '@/config/retired'
import { DbFullProfile } from '@/types/database/dbTypeAliases'

const initialFormData: AdminIssueTicketInput = {
  ticketType: TICKET_TYPES.PLAYER,
  purchaserName: '',
  purchaserEmail: '',
  sendEmail: true,
  isTest: false,
  ownerId: undefined,
  couponCodes: [],
  usdPaid: undefined,
  btcPaid: undefined,
  opennodeOrderId: undefined,
  stripePaymentId: undefined,
}

export function IssueTicketForm({}: {
  searchParams?: Promise<Record<string, string | undefined>>
} = {}) {
  const [formData, setFormData] =
    useState<AdminIssueTicketInput>(initialFormData)
  const [forExistingUser, setForExistingUser] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [existingUsers, setExistingUsers] = useState<DbFullProfile[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [extraFieldsOpen, setExtraFieldsOpen] = useState(false)
  const [usdPaidInput, setUsdPaidInput] = useState('')
  const [btcPaidInput, setBtcPaidInput] = useState('')

  const USD_DECIMAL = /^\d*\.?\d{0,2}$/
  const BTC_DECIMAL = /^\d*\.?\d{0,8}$/
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true)
      try {
        const userProfiles = await fetch('/api/queries/profiles')
        if (!userProfiles.ok) {
          throw new Error('Failed to load users')
        }
        const users = (await userProfiles.json()) as ApiAllFullProfilesResponse
        setExistingUsers(users)
      } catch (err) {
        console.error('Failed to load users:', err)
      } finally {
        setLoadingUsers(false)
      }
    }
    loadUsers()
  }, [])

  const updateFormData = (updates: Partial<AdminIssueTicketInput>) => {
    setFormData((prev) => ({ ...prev, ...updates }))
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setUsdPaidInput('')
    setBtcPaidInput('')
  }

  const validateForm = (): string | null => {
    // Basic required field validation
    if (forExistingUser && !formData.ownerId) {
      return 'Please select an existing user'
    }

    if (!forExistingUser && !formData.purchaserEmail) {
      return 'Please enter a purchaser email'
    }

    if (!formData.ticketType) {
      return 'Please select a ticket type'
    }

    // Business rule validation
    if (formData.btcPaid && formData.usdPaid) {
      return 'Cannot specify both BTC and USD payment amounts'
    }

    if (formData.stripePaymentId && formData.opennodeOrderId) {
      return 'Cannot specify both Stripe and Opennode payment IDs'
    }

    return null
  }

  const handleIssueTicket = async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const payload = {
        ...formData,
        purchaserName: (formData.purchaserName || '').trim(),
      }
      const result = await adminIssueTicket(payload)
      setSuccess(
        `Ticket issued successfully! Ticket code: ${result.dbTicket.ticket_code}. Full result: ${JSON.stringify(result, null, 2)}`,
      )
      console.log(result)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue ticket')
    } finally {
      setLoading(false)
    }
  }

  const isFormValid = () => {
    return validateForm() === null
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Required fields first */}
        <div>
          <Label htmlFor="ticketType">Ticket Type *</Label>
          <Select
            value={formData.ticketType}
            onValueChange={(value) =>
              updateFormData({
                ticketType:
                  value as (typeof TICKET_TYPES)[keyof typeof TICKET_TYPES],
              })
            }
          >
            <SelectTrigger id="ticketType" className="mt-1">
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

        <div className="flex flex-col gap-2">
          <Label id="issueToLabel">Issue to *</Label>
          <RadioGroup
            aria-labelledby="issueToLabel"
            value={forExistingUser ? 'existing' : 'new'}
            onValueChange={(value) => {
              setForExistingUser(value === 'existing')
            }}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="existing" id="existing" />
              <Label htmlFor="existing">Existing User</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="new" />
              <Label htmlFor="new">New Purchaser</Label>
            </div>
          </RadioGroup>
        </div>

        {forExistingUser && (
          <div>
            <Label htmlFor="ownerId">Select User *</Label>
            <Select
              value={formData.ownerId || ''}
              onValueChange={(value) => {
                const selectedUser = existingUsers.find(
                  (user) => user.id === value,
                )
                updateFormData({
                  ownerId: value,
                  purchaserName:
                    (selectedUser
                      ? `${selectedUser.first_name} ${selectedUser.last_name}`.trim()
                      : '') || undefined,
                  purchaserEmail: selectedUser?.email || undefined,
                })
              }}
            >
              <SelectTrigger id="ownerId" className="mt-1">
                <SelectValue
                  placeholder={
                    loadingUsers ? 'Loading users...' : 'Select existing user'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {existingUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.first_name ?? ''} {user.last_name ?? ''}{' '}
                    {user.email ?? ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="purchaserEmail">
            Purchaser Email{' '}
            {!forExistingUser && <span className="text-red-500">*</span>}
          </Label>
          <Input
            id="purchaserEmail"
            type="email"
            value={formData.purchaserEmail}
            onChange={(e) => updateFormData({ purchaserEmail: e.target.value })}
            placeholder="Enter purchaser/destination email address"
            className="mt-1"
          />
        </div>

        {/* Optional fields */}
        <div>
          <Label htmlFor="purchaserName">Purchaser Name</Label>
          <Input
            id="purchaserName"
            type="text"
            value={formData.purchaserName}
            onChange={(e) => updateFormData({ purchaserName: e.target.value })}
            placeholder="Enter purchaser name (optional)"
            className="mt-1"
          />
        </div>

        <Collapsible open={extraFieldsOpen} onOpenChange={setExtraFieldsOpen}>
          <div className="flex items-center">
            Extra Fields
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon">
                {extraFieldsOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="flex flex-col gap-4">
            <div>
              <Label htmlFor="couponCodes">Coupon Codes</Label>
              <Input
                id="couponCodes"
                type="text"
                value={(formData.couponCodes || []).join(', ')}
                onChange={(e) =>
                  updateFormData({
                    couponCodes: e.target.value
                      .split(',')
                      .map((code) => code.trim())
                      .filter((code) => code.length > 0),
                  })
                }
                placeholder="Enter coupon codes separated by commas"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="usdPaid">USD Paid</Label>
                <Input
                  id="usdPaid"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="mt-1"
                  value={usdPaidInput}
                  onChange={(e) => {
                    const v = e.target.value.replace(',', '.')
                    if (v === '' || USD_DECIMAL.test(v)) {
                      setUsdPaidInput(v)
                      updateFormData({
                        usdPaid:
                          v === ''
                            ? undefined
                            : Number.isFinite(parseFloat(v))
                              ? parseFloat(v)
                              : undefined,
                      })
                    }
                  }}
                />
              </div>
              <div>
                <Label htmlFor="btcPaid">BTC Paid</Label>
                <Input
                  id="btcPaid"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00000000"
                  className="mt-1"
                  value={btcPaidInput}
                  onChange={(e) => {
                    const v = e.target.value.replace(',', '.')
                    if (v === '' || BTC_DECIMAL.test(v)) {
                      setBtcPaidInput(v)
                      updateFormData({
                        btcPaid:
                          v === ''
                            ? undefined
                            : Number.isFinite(parseFloat(v))
                              ? parseFloat(v)
                              : undefined,
                      })
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="opennodeOrderId">Opennode Order ID</Label>
                <Input
                  id="opennodeOrderId"
                  type="text"
                  value={formData.opennodeOrderId || ''}
                  onChange={(e) =>
                    updateFormData({ opennodeOrderId: e.target.value.trim() })
                  }
                  placeholder="Enter Opennode order ID"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="stripePaymentId">Stripe Payment ID</Label>
                <Input
                  id="stripePaymentId"
                  type="text"
                  value={formData.stripePaymentId || ''}
                  onChange={(e) =>
                    updateFormData({ stripePaymentId: e.target.value.trim() })
                  }
                  placeholder="Enter Stripe payment ID"
                  className="mt-1"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sendEmail"
              checked={formData.sendEmail}
              disabled={INTEGRATIONS_RETIRED}
              onCheckedChange={(checked) =>
                updateFormData({ sendEmail: checked as boolean })
              }
            />
            <Label htmlFor="sendEmail">
              Send confirmation email
              {INTEGRATIONS_RETIRED && ' (email retired)'}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isTest"
              checked={formData.isTest}
              onCheckedChange={(checked) =>
                updateFormData({ isTest: checked as boolean })
              }
            />
            <Label htmlFor="isTest">Mark as test ticket</Label>
          </div>
        </div>

        <Button
          onClick={handleIssueTicket}
          disabled={loading || !isFormValid()}
          className="w-full"
        >
          {loading ? 'Issuing Ticket...' : 'Issue Ticket'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-md border border-green-500/20 bg-green-500/10 p-4">
          <Textarea
            aria-label="Ticket issue result"
            className="text-green-400"
            value={success}
            readOnly
          />
        </div>
      )}
    </div>
  )
}
