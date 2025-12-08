import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginForm from './LoginForm'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function LoginPage() {
  // Check if user is already authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If authenticated, redirect to dashboard
  if (user) {
    redirect('/dashboard')
  }

  // If not authenticated, show login form
  return (
    <div className="w-full flex flex-col items-center mt-10">
      <Link href="/" className="mb-6">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Home
        </Button>
      </Link>

      <LoginForm />
    </div>
  )
}
