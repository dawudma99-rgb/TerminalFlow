import https from 'https'
import { NextResponse, type NextRequest } from 'next/server'

export const runtime = 'nodejs'

const COOKIE_CHUNK_SIZE = 3180
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60

type SupabasePasswordResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  expires_at?: number
  refresh_token?: string
  user?: unknown
  msg?: string
  error_description?: string
  error?: string
}

function base64Url(value: string) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function getStorageKey(supabaseUrl: string) {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  return `sb-${projectRef}-auth-token`
}

function postPasswordGrant(params: {
  supabaseUrl: string
  supabaseAnonKey: string
  email: string
  password: string
}) {
  return new Promise<{ statusCode: number; body: SupabasePasswordResponse }>((resolve, reject) => {
    const url = new URL(`${params.supabaseUrl}/auth/v1/token?grant_type=password`)
    const body = JSON.stringify({
      email: params.email,
      password: params.password,
    })

    const request = https.request(
      {
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          apikey: params.supabaseAnonKey,
          authorization: `Bearer ${params.supabaseAnonKey}`,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      },
      (response) => {
        let raw = ''
        response.on('data', (chunk) => {
          raw += chunk
        })
        response.on('end', () => {
          try {
            resolve({
              statusCode: response.statusCode ?? 500,
              body: raw ? JSON.parse(raw) : {},
            })
          } catch {
            reject(new Error(raw || 'Supabase returned an invalid response'))
          }
        })
      }
    )

    request.setTimeout(15000, () => {
      request.destroy(new Error('Supabase auth request timed out'))
    })
    request.on('error', reject)
    request.end(body)
  })
}

function setSupabaseAuthCookie(response: NextResponse, storageKey: string, value: string) {
  const encoded = `base64-${base64Url(value)}`
  const chunks =
    encoded.length <= COOKIE_CHUNK_SIZE
      ? [{ name: storageKey, value: encoded }]
      : Array.from({ length: Math.ceil(encoded.length / COOKIE_CHUNK_SIZE) }, (_, index) => ({
          name: `${storageKey}.${index}`,
          value: encoded.slice(index * COOKIE_CHUNK_SIZE, (index + 1) * COOKIE_CHUNK_SIZE),
        }))

  response.cookies.set(storageKey, '', {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    maxAge: 0,
  })

  for (let index = 0; index < 5; index += 1) {
    response.cookies.set(`${storageKey}.${index}`, '', {
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      maxAge: 0,
    })
  }

  for (const chunk of chunks) {
    response.cookies.set(chunk.name, chunk.value, {
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      maxAge: COOKIE_MAX_AGE,
    })
  }
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email = formData.get('email')?.toString().trim() ?? ''
  const password = formData.get('password')?.toString() ?? ''
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(
      new URL('/login?error=Missing%20Supabase%20environment%20variables', request.url),
      { status: 303 }
    )
  }

  let result: Awaited<ReturnType<typeof postPasswordGrant>>
  try {
    result = await postPasswordGrant({
      supabaseUrl,
      supabaseAnonKey,
      email,
      password,
    })
  } catch (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unable to contact Supabase')}`,
        request.url
      ),
      { status: 303 }
    )
  }

  if (result.statusCode >= 400 || !result.body.access_token || !result.body.refresh_token) {
    const message =
      result.body.msg ??
      result.body.error_description ??
      result.body.error ??
      'Unable to sign in'

    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    )
  }

  const expiresAt =
    result.body.expires_at ??
    Math.floor(Date.now() / 1000) + (result.body.expires_in ?? 3600)
  const session = {
    access_token: result.body.access_token,
    token_type: result.body.token_type ?? 'bearer',
    expires_in: result.body.expires_in ?? 3600,
    expires_at: expiresAt,
    refresh_token: result.body.refresh_token,
    user: result.body.user,
  }
  const response = NextResponse.redirect(new URL('/dashboard', request.url), {
    status: 303,
  })

  setSupabaseAuthCookie(response, getStorageKey(supabaseUrl), JSON.stringify(session))

  return response
}
