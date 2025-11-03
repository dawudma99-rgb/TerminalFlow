import { signIn } from '@/lib/auth/actions'
import { redirect } from 'next/navigation'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <form action={async (formData) => {
        "use server"
        const email = formData.get("email")?.toString() || ""
        const password = formData.get("password")?.toString() || ""
        await signIn(email, password)
        redirect("/dashboard")
      }} 
      className="flex flex-col gap-4 w-full max-w-sm bg-white p-6 rounded-xl shadow">
        <h1 className="text-xl font-semibold text-gray-800">Sign In</h1>
        <input
          type="email"
          name="email"
          placeholder="Email"
          className="border p-2 rounded-md"
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          className="border p-2 rounded-md"
          required
        />
        <button
          type="submit"
          className="bg-blue-600 text-white rounded-md p-2 hover:bg-blue-700 transition"
        >
          Sign In
        </button>
      </form>
    </main>
  )
}

