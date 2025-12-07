# Authentication Logout & Session Persistence Discovery Report

**Date:** Discovery Phase  
**Purpose:** Understand why logging out and signing in with another account logs the user back in as the previous user  
**Scope:** Read-only discovery – no code changes

---

## Executive Summary

After comprehensive analysis of the authentication system, the root cause of the logout/login issue is:

**The `signOut()` server action calls `supabase.auth.signOut()` which attempts to clear cookies, but the server-side cookie clearing mechanism may not fully clear all Supabase auth cookies (particularly the refresh token cookie). When a new user signs in, the middleware's `getUser()` call can use a still-valid refresh token cookie to restore the previous user's session.**

---

## 1. Supabase Auth Initialization Points

### 1.1 Browser Client

**File:** `lib/supabase/client.ts`

- **Function:** Direct export (singleton)
- **Auth Helper Used:** `createBrowserClient` from `@supabase/ssr`
- **Cookie Handling:** Automatic browser cookie management via `@supabase/ssr`
- **Usage Context:** Client components and React hooks
- **Key Characteristics:**
  - Singleton pattern (one instance for entire app)
  - Client-side only (`'use client'` directive)
  - Automatically reads/writes browser cookies

```typescript
export const supabase = createBrowserClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
```

---

### 1.2 Server Client

**File:** `lib/supabase/server.ts`

- **Function:** `createClient()` (async factory)
- **Auth Helper Used:** `createServerClient` from `@supabase/ssr`
- **Cookie Handling:** 
  - Uses `cookies()` from `next/headers`
  - Provides `get()`, `set()`, and `remove()` handlers
  - Cookie `set()` calls are wrapped in try/catch and silently fail in Server Components
- **Usage Context:** Server actions and server components
- **Key Characteristics:**
  - Creates a new client per request
  - Reads cookies via Next.js `cookies()` API
  - Assumes middleware has already refreshed session
  - Cookie `set()` operations may fail silently in Server Components

```typescript
export async function createClient() {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(...)
  // Cookie handlers: get(), set(), remove()
}
```

---

### 1.3 Middleware Client

**File:** `lib/supabase/middleware.ts`

- **Function:** `createClient(request: NextRequest)`
- **Auth Helper Used:** `createServerClient` from `@supabase/ssr`
- **Cookie Handling:**
  - Uses `getAll()` and `setAll()` handlers
  - Reads from `request.cookies`
  - Writes to both `request.cookies` and `response.cookies`
- **Usage Context:** Edge middleware (runs on every request)
- **Key Characteristics:**
  - Edge runtime compatible
  - Handles cookie refresh automatically via `getAll()`/`setAll()`
  - Returns both `supabase` client and `response` object

```typescript
export function createClient(request: NextRequest) {
  const supabase = createServerClient<Database>(...)
  // Cookie handlers: getAll(), setAll()
  return { supabase, response }
}
```

---

### 1.4 Summary: Supabase Initialization Points

| File Path | Function Name | Auth Helper Used | Cookie Handling |
|-----------|---------------|------------------|-----------------|
| `lib/supabase/client.ts` | `supabase` (export) | `createBrowserClient` | Automatic browser cookies |
| `lib/supabase/server.ts` | `createClient()` | `createServerClient` | `cookies()` from `next/headers` |
| `lib/supabase/middleware.ts` | `createClient(request)` | `createServerClient` | `request.cookies` / `response.cookies` |

---

## 2. Logout / Sign-Out Paths

### 2.1 Server Action: `signOut()`

**File:** `lib/auth/actions.ts` (lines 49-53)

**Implementation:**
```typescript
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/')
}
```

**Analysis:**
- ✅ Creates server client using `createClient()` from `lib/supabase/server.ts`
- ✅ Calls `supabase.auth.signOut()` which should clear Supabase auth cookies
- ✅ Calls `revalidatePath('/')` to invalidate Next.js route cache
- ❌ **No explicit redirect** - relies on middleware/client to handle navigation
- ❌ **No explicit cookie deletion** - relies entirely on Supabase's `signOut()` to clear cookies
- ⚠️ **Potential Issue:** Server client's cookie `set()`/`remove()` handlers may silently fail in Server Actions context

**Cookie Clearing Mechanism:**
- `supabase.auth.signOut()` internally attempts to clear cookies via the cookie handlers
- However, the server client's `remove()` handler (line 44-51) wraps cookie deletion in try/catch and may fail silently
- The refresh token cookie (`sb-<project-ref>-auth-token`) may persist if the deletion fails

---

### 2.2 Client Component: `Topbar.tsx`

**File:** `components/layout/Topbar.tsx` (lines 45-57)

**Implementation:**
```typescript
const handleSignOut = async () => {
  setIsSigningOut(true)
  
  try {
    await signOut()  // Calls server action
    router.push('/login')
    router.refresh()
  } catch (error) {
    logger.error('Sign out error:', error)
    setIsSigningOut(false)
  }
}
```

**Analysis:**
- ✅ Calls `signOut()` server action
- ✅ Redirects to `/login` after logout
- ✅ Calls `router.refresh()` to refresh server state
- ⚠️ **No client-side cookie clearing** - relies entirely on server action
- ⚠️ **No explicit browser cookie deletion** - if server-side clearing fails, cookies persist

---

### 2.3 Client Hook: `useAuth.ts`

**File:** `lib/auth/useAuth.ts` (lines 132-142)

**Implementation:**
```typescript
case 'SIGNED_OUT': {
  startTransition();
  setUser(null);
  setProfile(null);
  // Clear all SWR caches on logout to prevent showing previous user's data
  globalMutate(() => true, undefined, { revalidate: false });
  endTransition();
  break;
}
```

**Analysis:**
- ✅ Handles `SIGNED_OUT` event from `onAuthStateChange` listener
- ✅ Clears React state (`user`, `profile`)
- ✅ Clears SWR caches
- ❌ **No explicit cookie clearing** - only clears cookies when `session` is null (lines 39-46), not on `SIGNED_OUT` event

**Manual Cookie Clearing (lines 39-46):**
```typescript
if (!session) {
  logger.warn("[useAuth] No session — clearing Supabase cookies");
  for (const cookie of document.cookie.split(";")) {
    if (cookie.trim().startsWith("sb-")) {
      const [name] = cookie.split("=");
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
  }
}
```

**Issue:** This cookie clearing only runs when `getSession()` returns `null`, not when the `SIGNED_OUT` event fires. If cookies persist after `signOut()`, this code won't run.

---

### 2.4 Route Handlers / API Routes

**Search Results:** No route handlers found for `/auth/signout`, `/logout`, or `/sign-out`

**Analysis:**
- ❌ **No dedicated logout route handler exists**
- ❌ **No server-side route that explicitly clears cookies**
- All logout flows go through the `signOut()` server action

---

### 2.5 Summary: Logout Implementations

| File Path | Component/Function | Implementation | Cookie Clearing |
|-----------|-------------------|----------------|-----------------|
| `lib/auth/actions.ts` | `signOut()` | Server action → `supabase.auth.signOut()` | Relies on Supabase (may fail silently) |
| `components/layout/Topbar.tsx` | `handleSignOut()` | Calls `signOut()`, then `router.push('/login')` | No explicit clearing |
| `lib/auth/useAuth.ts` | `SIGNED_OUT` handler | Clears state + SWR cache | No explicit clearing (only clears if `session` is null) |
| **No route handlers** | N/A | N/A | N/A |

---

## 3. Cookie Handling & Middleware

### 3.1 Middleware Implementation

**File:** `middleware.ts`

**Implementation:**
```typescript
export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request)
  
  // Get user authentication - getUser() will refresh the session if needed
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  // Protect dashboard routes
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  return response
}
```

**Analysis:**
- ✅ Uses `createClient()` from `lib/supabase/middleware.ts`
- ✅ Calls `getUser()` which automatically refreshes the session if needed
- ✅ Protects `/dashboard` routes
- ⚠️ **Critical Issue:** `getUser()` will refresh the session using **any valid refresh token cookie** it finds
- ⚠️ **If refresh token cookie persists after logout, `getUser()` will restore the previous user's session**

**Cookie Refresh Mechanism:**
- `getUser()` internally calls `getSession()` which checks for refresh token cookies
- If a valid refresh token cookie exists, it automatically exchanges it for a new access token
- This happens **before** checking if the user is authenticated
- If the previous user's refresh token cookie wasn't deleted, `getUser()` will restore their session

---

### 3.2 Cookie Naming Convention

**Supabase Cookie Names:**
- Access token: `sb-<project-ref>-auth-token` (contains access token)
- Refresh token: `sb-<project-ref>-auth-token` (contains refresh token in same cookie, or separate cookie)
- Supabase uses a single cookie with both tokens, or separate cookies depending on configuration

**Cookie Clearing:**
- `supabase.auth.signOut()` should clear these cookies via the cookie handlers
- However, the server client's `remove()` handler may fail silently in Server Actions

---

### 3.3 Manual Cookie Manipulation

**File:** `lib/auth/useAuth.ts` (lines 39-46)

**Implementation:**
```typescript
if (!session) {
  logger.warn("[useAuth] No session — clearing Supabase cookies");
  for (const cookie of document.cookie.split(";")) {
    if (cookie.trim().startsWith("sb-")) {
      const [name] = cookie.split("=");
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
  }
}
```

**Analysis:**
- ✅ Clears all cookies starting with `sb-` prefix
- ❌ **Only runs when `getSession()` returns `null`**
- ❌ **Does not run on `SIGNED_OUT` event**
- ⚠️ **If cookies persist after `signOut()`, this code won't execute**

---

### 3.4 Summary: Cookie Handling

| Component | Cookie Operations | Notes |
|-----------|------------------|-------|
| `middleware.ts` | Reads/writes via `getAll()`/`setAll()` | Automatically refreshes session using refresh token |
| `lib/supabase/server.ts` | `get()`, `set()`, `remove()` handlers | `set()`/`remove()` may fail silently in Server Components |
| `lib/auth/useAuth.ts` | Manual `document.cookie` clearing | Only runs when `session` is null, not on `SIGNED_OUT` event |
| **No explicit cookie deletion in `signOut()`** | N/A | Relies entirely on Supabase's internal cookie clearing |

---

## 4. How Current Session Is Loaded

### 4.1 Middleware Session Check

**File:** `middleware.ts` (line 15)

**Implementation:**
```typescript
const { data: { user }, error: userError } = await supabase.auth.getUser()
```

**Analysis:**
- **Context:** Edge middleware (runs on every `/dashboard` request)
- **Method:** `getUser()` which internally calls `getSession()` and refreshes if needed
- **Cookie Dependency:** Reads Supabase auth cookies from `request.cookies`
- **Behavior:** 
  - If refresh token cookie exists and is valid, automatically refreshes session
  - Returns the user associated with the refresh token
  - **This is where the previous user's session can be restored**

---

### 4.2 Client Hook: `useAuth.ts`

**File:** `lib/auth/useAuth.ts` (lines 30-94)

**Implementation:**
```typescript
useEffect(() => {
  async function load() {
    const { data: { session }, error } = await supabase.auth.getSession()
    // ... handle session
  }
  load()
  
  const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
    // ... handle auth state changes
  })
}, [])
```

**Analysis:**
- **Context:** Client component (browser)
- **Method:** `getSession()` on mount + `onAuthStateChange` listener
- **Cookie Dependency:** Reads from browser cookies (`document.cookie`)
- **Behavior:**
  - Loads session on component mount
  - Listens for auth state changes (SIGNED_IN, SIGNED_OUT, etc.)
  - If cookies persist, `getSession()` will return the previous user's session

---

### 4.3 Server Actions: `getServerAuthContext()`

**File:** `lib/auth/serverAuthContext.ts` (lines 31-64)

**Implementation:**
```typescript
export async function getServerAuthContext(): Promise<ServerAuthContext> {
  const supabase = await createClient()
  const { data: { user }, error: getUserError } = await supabase.auth.getUser()
  // ... validate and return user + profile
}
```

**Analysis:**
- **Context:** Server actions and server components
- **Method:** `getUser()` via server client
- **Cookie Dependency:** Reads from `cookies()` via `next/headers`
- **Behavior:**
  - Creates server client which reads cookies
  - Calls `getUser()` which refreshes session if needed
  - If refresh token cookie persists, will restore previous user's session

---

### 4.4 Server Actions: `getCurrentUser()` / `getCurrentProfile()`

**File:** `lib/auth/actions.ts` (lines 55-73)

**Implementation:**
```typescript
export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
```

**Analysis:**
- **Context:** Server actions
- **Method:** `getUser()` via server client
- **Cookie Dependency:** Same as `getServerAuthContext()`
- **Behavior:** Same session restoration risk

---

### 4.5 Layout Files

**Files Checked:**
- `app/layout.tsx` - No auth pre-loading
- `app/dashboard/layout.tsx` - No auth pre-loading

**Analysis:**
- ✅ No session pre-loading in layouts
- Session is loaded on-demand by components/actions

---

### 4.6 Summary: Session Loading Points

| File Path | Function/Method | Context | Cookie Source | Session Restoration Risk |
|-----------|----------------|---------|---------------|-------------------------|
| `middleware.ts` | `getUser()` | Edge middleware | `request.cookies` | **HIGH** - Runs on every request |
| `lib/auth/useAuth.ts` | `getSession()` + `onAuthStateChange` | Client component | Browser cookies | **MEDIUM** - Runs on mount |
| `lib/auth/serverAuthContext.ts` | `getUser()` | Server action/component | `cookies()` from `next/headers` | **MEDIUM** - Runs on-demand |
| `lib/auth/actions.ts` | `getUser()` | Server action | `cookies()` from `next/headers` | **MEDIUM** - Runs on-demand |

---

## 5. Current Logout Behavior vs. Expected Behavior

### 5.1 Current Logout Flow

**Step-by-Step Analysis:**

1. **User clicks "Sign Out" button** (`Topbar.tsx`)
   - `handleSignOut()` is called
   - Sets `isSigningOut` state to `true`

2. **Server action `signOut()` is called** (`lib/auth/actions.ts`)
   - Creates server client via `createClient()`
   - Calls `supabase.auth.signOut()`
   - Supabase attempts to clear cookies via cookie handlers
   - **Potential Issue:** Cookie `remove()` handler may fail silently in Server Actions
   - Calls `revalidatePath('/')`

3. **Client redirects** (`Topbar.tsx`)
   - `router.push('/login')` is called
   - `router.refresh()` is called

4. **Auth state change event** (`useAuth.ts`)
   - `onAuthStateChange` fires with `SIGNED_OUT` event
   - Clears React state (`user`, `profile`)
   - Clears SWR caches
   - **Does NOT explicitly clear cookies** (only clears if `session` is null)

5. **New user signs in**
   - `signIn()` server action creates new session
   - New cookies are written

6. **Middleware runs on next request** (`middleware.ts`)
   - Calls `getUser()` which checks for refresh token cookie
   - **If previous user's refresh token cookie still exists, `getUser()` will restore their session**
   - User is logged in as previous user instead of new user

---

### 5.2 Why This Causes the Issue

**Root Cause Explanation:**

1. **Incomplete Cookie Clearing:**
   - `signOut()` calls `supabase.auth.signOut()` which attempts to clear cookies
   - However, the server client's cookie `remove()` handler (lines 44-51 in `lib/supabase/server.ts`) wraps deletion in try/catch and may fail silently
   - The refresh token cookie may persist if the deletion fails

2. **Middleware Session Restoration:**
   - When a new user signs in, middleware runs on the next request
   - `getUser()` automatically refreshes the session using **any valid refresh token cookie** it finds
   - If the previous user's refresh token cookie still exists, `getUser()` will restore their session
   - The new user's session is overwritten by the previous user's session

3. **No Explicit Cookie Deletion:**
   - No code explicitly deletes the `sb-<project-ref>-auth-token` cookie
   - No code explicitly deletes refresh token cookies
   - Relies entirely on Supabase's internal cookie clearing, which may fail

4. **Client-Side Cookie Clearing Doesn't Run:**
   - `useAuth.ts` has manual cookie clearing, but it only runs when `getSession()` returns `null`
   - It does not run on the `SIGNED_OUT` event
   - If cookies persist after `signOut()`, `getSession()` may still return a session, so the clearing code never runs

---

### 5.3 Expected vs. Actual Behavior

| Step | Expected Behavior | Actual Behavior |
|------|------------------|------------------|
| User clicks "Sign Out" | All auth cookies deleted | Cookies may persist if deletion fails |
| New user signs in | New session created | New session created |
| Middleware runs | Uses new user's session | **Uses previous user's refresh token, restores old session** |
| User sees | New user's account | **Previous user's account** |

---

## 6. Final Summary & Change Plan Stub

### 6.1 Summary: How Auth Is Currently Wired

The application uses a **three-layer Supabase auth architecture** with `@supabase/ssr`:

1. **Browser Layer** (`lib/supabase/client.ts`)
   - Singleton browser client using `createBrowserClient`
   - Automatically manages browser cookies
   - Used by client components and React hooks

2. **Server Layer** (`lib/supabase/server.ts`)
   - Factory function `createClient()` creates server client per request
   - Uses `cookies()` from `next/headers` to read/write cookies
   - Cookie `set()`/`remove()` operations may fail silently in Server Components

3. **Middleware Layer** (`lib/supabase/middleware.ts` + `middleware.ts`)
   - Edge middleware runs on every `/dashboard` request
   - Uses `getAll()`/`setAll()` cookie handlers
   - Automatically refreshes session using refresh token cookies

**Session Loading:**
- Middleware calls `getUser()` on every request (high risk of session restoration)
- Client hook `useAuth()` calls `getSession()` on mount
- Server actions call `getUser()` on-demand

---

### 6.2 Summary: How Logout Currently Works

**Current Logout Flow:**

1. **Client Component** (`Topbar.tsx`) calls `signOut()` server action
2. **Server Action** (`lib/auth/actions.ts`) calls `supabase.auth.signOut()`
3. **Supabase** attempts to clear cookies via cookie handlers (may fail silently)
4. **Client** redirects to `/login` and refreshes router
5. **Client Hook** (`useAuth.ts`) handles `SIGNED_OUT` event, clears state and SWR cache
6. **No explicit cookie deletion** happens anywhere

**Issues:**
- Cookie clearing relies entirely on Supabase's internal mechanism
- Server client's cookie `remove()` handler may fail silently
- No explicit deletion of refresh token cookies
- Client-side cookie clearing only runs when `session` is null, not on `SIGNED_OUT` event

---

### 6.3 Summary: Why Supabase Restores Old Session

**The Problem:**

1. **Incomplete Cookie Deletion:**
   - `signOut()` calls `supabase.auth.signOut()` which attempts to clear cookies
   - The server client's cookie `remove()` handler may fail silently in Server Actions context
   - Refresh token cookie (`sb-<project-ref>-auth-token`) may persist

2. **Automatic Session Restoration:**
   - Middleware calls `getUser()` on every request
   - `getUser()` automatically refreshes the session using **any valid refresh token cookie** it finds
   - If the previous user's refresh token cookie still exists, `getUser()` will restore their session
   - The new user's session is overwritten by the previous user's session

3. **No Explicit Cookie Clearing:**
   - No code explicitly deletes Supabase auth cookies
   - Client-side clearing only runs when `session` is null, not on `SIGNED_OUT` event
   - If cookies persist, `getSession()` may still return a session, so clearing code never runs

**In Plain English:**

When you log out, the app tries to delete your authentication cookies, but this deletion may fail silently on the server. The refresh token cookie (which allows automatic re-login) may still exist. When you sign in with a different account, the middleware automatically checks for refresh token cookies and uses them to restore your session. If the old refresh token cookie is still there, it restores the previous user's session instead of using the new user's session.

---

### 6.4 Change Plan Stub (No Edits Yet)

**Files That Need Changes:**

#### 6.4.1 Critical: Explicit Cookie Deletion in `signOut()`

**File:** `lib/auth/actions.ts`

**Current State:**
- `signOut()` calls `supabase.auth.signOut()` and relies on it to clear cookies
- No explicit cookie deletion

**Required Changes:**
- After `supabase.auth.signOut()`, explicitly delete all Supabase auth cookies
- Use `cookies()` from `next/headers` to delete cookies by name
- Delete both access token and refresh token cookies
- Ensure cookie deletion happens before `revalidatePath()`

**Example Change:**
```typescript
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  // Explicitly delete Supabase auth cookies
  const cookieStore = await cookies()
  // Delete all cookies starting with 'sb-' prefix
  // ... explicit deletion logic
  
  revalidatePath('/')
}
```

---

#### 6.4.2 Critical: Client-Side Cookie Clearing on `SIGNED_OUT` Event

**File:** `lib/auth/useAuth.ts`

**Current State:**
- `SIGNED_OUT` event handler clears state and SWR cache
- Does NOT clear cookies (only clears if `session` is null)

**Required Changes:**
- In `SIGNED_OUT` event handler, explicitly clear all `sb-` prefixed cookies
- Use the existing cookie clearing logic (lines 41-45) but call it in the `SIGNED_OUT` handler
- Ensure cookies are cleared immediately when `SIGNED_OUT` event fires

**Example Change:**
```typescript
case 'SIGNED_OUT': {
  startTransition();
  setUser(null);
  setProfile(null);
  
  // Explicitly clear Supabase cookies
  for (const cookie of document.cookie.split(";")) {
    if (cookie.trim().startsWith("sb-")) {
      const [name] = cookie.split("=");
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
  }
  
  globalMutate(() => true, undefined, { revalidate: false });
  endTransition();
  break;
}
```

---

#### 6.4.3 Optional: Create Dedicated Logout Route Handler

**File:** `app/auth/signout/route.ts` (new file)

**Current State:**
- No logout route handler exists
- All logout goes through server action

**Optional Enhancement:**
- Create a POST route handler that explicitly clears cookies
- Use `createRouteHandlerClient({ cookies })` from `@supabase/auth-helpers-nextjs` (if available) or use `createClient()` from `lib/supabase/server.ts`
- Explicitly delete all Supabase auth cookies
- Return success response

**Note:** This is optional if server action cookie deletion is fixed. The server action approach should work if cookie deletion is explicit.

---

#### 6.4.4 Optional: Improve Server Client Cookie Deletion

**File:** `lib/supabase/server.ts`

**Current State:**
- Cookie `remove()` handler wraps deletion in try/catch and may fail silently
- Comment says "This can be ignored if you have middleware refreshing" - but this creates inconsistency

**Optional Enhancement:**
- Log cookie deletion failures instead of silently ignoring them
- Or ensure cookie deletion always succeeds in Server Actions context
- Consider using `cookies().delete()` instead of `cookies().set({ name, value: '' })`

---

### 6.5 Summary of Required Changes

| Priority | File | Change Required |
|----------|------|----------------|
| **CRITICAL** | `lib/auth/actions.ts` | Add explicit cookie deletion in `signOut()` after `supabase.auth.signOut()` |
| **CRITICAL** | `lib/auth/useAuth.ts` | Add explicit cookie clearing in `SIGNED_OUT` event handler |
| **OPTIONAL** | `app/auth/signout/route.ts` | Create dedicated logout route handler with explicit cookie deletion |
| **OPTIONAL** | `lib/supabase/server.ts` | Improve cookie `remove()` handler to log failures or ensure success |

---

### 6.6 Testing Plan (For Future Implementation)

After implementing the changes, test the following scenarios:

1. **Basic Logout:**
   - Sign in as User A
   - Click "Sign Out"
   - Verify all `sb-` cookies are deleted (check browser DevTools)
   - Verify user is redirected to `/login`

2. **Account Switching:**
   - Sign in as User A
   - Sign out
   - Sign in as User B
   - Verify User B's account is shown (not User A's)
   - Verify middleware uses User B's session

3. **Session Persistence After Logout:**
   - Sign in as User A
   - Sign out
   - Wait 5 seconds
   - Try to access `/dashboard` directly
   - Verify redirect to `/login` (no session restoration)

4. **Multiple Logout Attempts:**
   - Sign in as User A
   - Click "Sign Out" multiple times rapidly
   - Verify cookies are cleared and no errors occur

---

## Conclusion

The root cause of the logout/login issue is **incomplete cookie deletion during logout**. The `signOut()` server action relies on Supabase's internal cookie clearing, which may fail silently. When a new user signs in, the middleware's `getUser()` call automatically restores the previous user's session using the still-valid refresh token cookie.

**The fix requires explicit cookie deletion in both the server action and the client-side `SIGNED_OUT` event handler to ensure all Supabase auth cookies are cleared before a new user signs in.**
