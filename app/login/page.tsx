'use client'

import { signIn } from '@/lib/auth/actions'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { LoaderBar } from '@/components/ui/LoaderBar'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email")?.toString() || ""
    const password = formData.get("password")?.toString() || ""

    try {
      const result = await signIn(email, password)

      if (!result.success) {
        setIsLoading(false)
        setErrorMessage(
          result.error ?? "Unable to sign in. Please try again."
        )
        return
      }

      // success: same as before
      router.push("/dashboard")
      router.refresh()
      // Transition is handled by useAuth on SIGNED_IN event
    } catch (error) {
      console.error("Unexpected sign-in error", error)
      setIsLoading(false)
      setErrorMessage(
        "Something went wrong while signing in. Please try again."
      )
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <LoaderBar />
      <form 
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 w-full max-w-sm bg-white p-6 rounded-xl shadow"
      >
        <h1 className="text-xl font-semibold text-gray-800">Sign In</h1>
        {errorMessage && (
          <p className="text-sm text-red-600">
            {errorMessage}
          </p>
        )}
        <input
          type="email"
          name="email"
          placeholder="Email"
          className="border p-2 rounded-md"
          required
          disabled={isLoading}
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          className="border p-2 rounded-md"
          required
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 text-white rounded-md p-2 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
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

