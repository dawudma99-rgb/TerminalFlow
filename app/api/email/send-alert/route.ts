import { NextResponse } from 'next/server'
import { sendAlertEmail } from '@/lib/email/sendAlertEmail'
import { createClient } from '@/lib/supabase/server'
import { hitRateLimit } from '@/lib/rate-limit/simpleLimiter'

export const runtime = 'nodejs'

/**
 * POST /api/email/send-alert
 * Sends an alert email to a user using Resend.
 * Requires authentication.
 */
export async function POST(request: Request) {
  // Check authentication
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Query profile to get organization_id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { success: false, error: 'User profile or organization is not configured correctly' },
      { status: 401 }
    )
  }

  if (!profile.organization_id) {
    return NextResponse.json(
      { success: false, error: 'User profile or organization is not configured correctly' },
      { status: 401 }
    )
  }

  const organizationId = profile.organization_id

  try {
    const body = await request.json()
    const { alertTitle, alertMessage, containerNo, recipientEmail } = body

    // Validate required fields
    if (!alertTitle || !alertMessage || !containerNo || !recipientEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: alertTitle, alertMessage, containerNo, recipientEmail' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // --- Rate limiting starts here ---
    const userId = user.id
    const recipient = typeof recipientEmail === 'string' ? recipientEmail.trim().toLowerCase() : ''

    // Per-organization limit: 20 emails per hour
    const orgResult = hitRateLimit(`email:org:${organizationId}`, {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20,
    })

    if (!orgResult.ok) {
      return NextResponse.json(
        { success: false, error: 'Email sending limit reached for this organization. Please try again later.' },
        { status: 429 }
      )
    }

    // Per-user limit: 20 emails per hour
    const userResult = hitRateLimit(`email:user:${userId}`, {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20,
    })

    if (!userResult.ok) {
      return NextResponse.json(
        { success: false, error: 'Email sending limit reached for this user. Please try again later.' },
        { status: 429 }
      )
    }

    // Per-recipient limit: 5 emails per hour to the same address
    if (recipient) {
      const recipientResult = hitRateLimit(`email:recipient:${recipient}`, {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 5,
      })

      if (!recipientResult.ok) {
        return NextResponse.json(
          { success: false, error: 'Too many emails have been sent to this recipient recently.' },
          { status: 429 }
        )
      }
    }

    // --- Existing email sending logic continues below ---
    // Send email using the helper
    const result = await sendAlertEmail({
      to: recipientEmail,
      subject: `${alertTitle} - Container ${containerNo}`,
      text: `Container: ${containerNo}\n\n${alertMessage}\n\nView all alerts: https://terminalflow.app/dashboard/alerts`,
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send email' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending alert email:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send email' 
      },
      { status: 500 }
    )
  }
}

