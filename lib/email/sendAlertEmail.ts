'use server'

import { Resend } from 'resend'
import { logger } from '@/lib/utils/logger'

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Sends an alert email using Resend.
 * 
 * This is a server-only function and should never be imported into client components.
 * 
 * @param params - Email parameters
 * @param params.to - Recipient email address
 * @param params.subject - Email subject line
 * @param params.text - Plain text email body
 * @param params.html - Optional HTML email body
 * @param params.replyTo - Optional reply-to email address
 * @param params.fromName - Optional custom display name for the "from" field
 * @returns Promise with success status and optional error message
 */
export async function sendAlertEmail(params: {
  to: string | string[]
  subject: string
  text: string
  html?: string
  replyTo?: string
  fromName?: string
}): Promise<{ success: boolean; error?: string }> {
  const { to, subject, text, html, replyTo, fromName } = params

  // Check if Resend API key is configured
  if (!process.env.RESEND_API_KEY) {
    logger.warn('[sendAlertEmail] Missing RESEND_API_KEY')
    return { success: false, error: 'Missing RESEND_API_KEY' }
  }

  try {
    // Get FROM email from env variable, default to alerts@terminalflow.app
    const fromEmail = process.env.EMAIL_FROM || 'alerts@terminalflow.app'
    const defaultFromName = 'TerminalFlow Alerts'
    const effectiveFromName = fromName && fromName.trim().length > 0
      ? fromName.trim()
      : defaultFromName

    const fromAddress = `${effectiveFromName} <${fromEmail}>`

    const emailData: {
      from: string
      to: string | string[]
      subject: string
      text: string
      html?: string
      reply_to?: string
    } = {
      from: fromAddress,
      to,
      subject,
      text,
    }

    if (html) {
      emailData.html = html
    }

    if (replyTo && replyTo.trim().length > 0) {
      emailData.reply_to = replyTo.trim()
    }

    const { data, error } = await resend.emails.send(emailData)

    if (error) {
      logger.error('[sendAlertEmail] Resend error', { to, error: error.message })
      return { success: false, error: error.message || 'Failed to send email' }
    }

    if (process.env.NODE_ENV === 'development') {
      logger.debug('[sendAlertEmail] Email sent successfully', { to, subject })
    }

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('[sendAlertEmail] Exception sending email', { to, error: errorMessage })
    return { success: false, error: errorMessage }
  }
}

