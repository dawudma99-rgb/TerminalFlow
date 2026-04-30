'use client'

import { supabase } from '@/lib/supabase/client'
import { LoaderBar } from '@/components/ui/LoaderBar'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type LoginFormProps = {
  errorMessage?: string | null
}

const SIGN_IN_TIMEOUT_MS = 15000

function timeoutPromise() {
  return new Promise<never>((_, reject) => {
    window.setTimeout(() => {
      reject(new Error('Supabase did not respond within 15 seconds. Check your connection and try again.'))
    }, SIGN_IN_TIMEOUT_MS)
  })
}

export default function LoginForm({ errorMessage }: LoginFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [clientError, setClientError] = useState<string | null>(errorMessage ?? null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setClientError(null)
    setStatusMessage('Contacting Supabase...')

    const formData = new FormData(event.currentTarget)
    const email = formData.get('email')?.toString().trim() ?? ''
    const password = formData.get('password')?.toString() ?? ''

    try {
      const { error } = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        timeoutPromise(),
      ])

      if (error) {
        setClientError(error.message)
        setStatusMessage(null)
        setIsLoading(false)
        return
      }

      setStatusMessage('Signed in. Opening dashboard...')
      router.replace('/dashboard')
      router.refresh()
    } catch (error) {
      setClientError(error instanceof Error ? error.message : 'Unable to sign in.')
      setStatusMessage(null)
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <LoaderBar />
      <form
        action="/auth/sign-in"
        method="post"
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-white p-6 shadow"
      >
        <h1 className="text-xl font-semibold text-gray-800">Sign In</h1>
        {clientError && (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {clientError}
          </p>
        )}
        {statusMessage && (
          <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            {statusMessage}
          </p>
        )}
        <input
          type="email"
          name="email"
          placeholder="Email"
          className="rounded-md border p-2"
          required
          disabled={isLoading}
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          className="rounded-md border p-2"
          required
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center justify-center gap-2 rounded-md bg-blue-600 p-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>
    </main>
  )
}
