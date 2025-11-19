import { NextResponse } from 'next/server'
import { sendAlertEmail } from '@/lib/email/sendAlertEmail'

export const runtime = 'nodejs'

/**
 * POST /api/email/send-alert
 * Sends an alert email to a user using Resend.
 */
export async function POST(request: Request) {
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

