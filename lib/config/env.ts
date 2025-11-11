import { z } from 'zod'

/**
 * Environment variable validation schema
 * Ensures all required environment variables are present and valid
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL format'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

/**
 * Validate environment variables at module load time
 * This will throw an error immediately if validation fails
 */
const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NODE_ENV: process.env.NODE_ENV || 'development',
})

if (!parsed.success) {
  const errors = parsed.error.flatten().fieldErrors
  console.error('❌ Invalid environment variables:', errors)
  throw new Error(
    `Environment variable validation failed. Missing or invalid:\n${JSON.stringify(errors, null, 2)}\n\nPlease check your .env.local file.`
  )
}

/**
 * Validated environment variables
 * Type-safe access to environment variables
 */
export const env = parsed.data

// Log successful validation in development
if (env.NODE_ENV === 'development') {
  console.log('✅ Environment variables loaded and validated successfully')
}





