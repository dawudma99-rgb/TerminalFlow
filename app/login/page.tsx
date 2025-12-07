import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  // Check if user is already authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If authenticated, redirect to dashboard
  if (user) {
    redirect('/dashboard')
  }

  // If not authenticated, show login form
  return <LoginForm />
}
