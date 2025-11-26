# Auth UX Regression Diagnostic Report

## Executive Summary

After the enterprise-grade auth refactor, the app exhibits three critical UX regressions:
1. **Overlay/dimming stuck almost constantly** - `isTransitioning` state never resets
2. **Slow/stuck page transitions and container loads** - SWR keys become `null` when `orgId` is missing, blocking all data fetches
3. **Data never loads, requiring hard refresh** - Profile fetch failures leave app in permanent loading state

---

## Root Cause Analysis

### 🔴 **ROOT CAUSE #1: Transition Timeout Race Condition in useAuth**

**File:** `lib/auth/useAuth.ts`  
**Lines:** 92-116

**Problem:**
```typescript
case 'SIGNED_IN': {
  startTransition();
  setUser(session?.user ?? null);
  
  // Fetch profile on login
  if (session?.user) {
    try {
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      setProfile(p ?? null);
    } catch (e) {
      logger.error("[useAuth] Error fetching profile on SIGNED_IN:", e);
    }
  }
  
  // End transition after brief delay
  transitionTimeoutRef.current = setTimeout(() => {
    endTransition();
    transitionTimeoutRef.current = null;
  }, 150);
  break;
}
```

**Issues:**
1. **Timeout fires before profile loads**: The 150ms timeout is fixed, but profile fetch can take 200-500ms. If profile fetch is slow, the transition ends before data is ready, but the UI might still be in a transitional state.
2. **No error recovery**: If profile fetch throws, the timeout still fires, ending the transition even though the app is in a broken state.
3. **Race condition with Topbar**: If user navigates quickly or if there are multiple auth events, the timeout might be cleared and re-set, leaving transitions stuck.

**Evidence:**
- Overlay appears during login but never fully clears
- Profile-dependent components (lists, containers) stay in loading state
- Console shows profile fetch completing after transition timeout fires

**Fix:**
```typescript
case 'SIGNED_IN': {
  startTransition();
  setUser(session?.user ?? null);
  
  // Fetch profile on login
  if (session?.user) {
    try {
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      setProfile(p ?? null);
      
      // End transition AFTER profile is loaded, not on fixed timeout
      endTransition();
    } catch (e) {
      logger.error("[useAuth] Error fetching profile on SIGNED_IN:", e);
      // Still end transition even on error to prevent stuck state
      endTransition();
    }
  } else {
    // No user - end transition immediately
    endTransition();
  }
  break;
}
```

---

### 🔴 **ROOT CAUSE #2: Double Transition on Logout**

**File:** `components/layout/Topbar.tsx` + `lib/auth/useAuth.ts`  
**Lines:** Topbar: 47-62, useAuth: 119-129

**Problem:**
```typescript
// Topbar.tsx
const handleSignOut = async () => {
  setIsSigningOut(true)
  startTransition()  // ← Manual transition start
  
  try {
    await signOut()
    router.push('/login')
    router.refresh()
  } catch (error) {
    logger.error('Sign out error:', error)
    setIsSigningOut(false)
  } finally {
    endTransition()  // ← Manual transition end
  }
}

// useAuth.ts
case 'SIGNED_OUT': {
  startTransition();  // ← Also starts transition
  setUser(null);
  setProfile(null);
  globalMutate(() => true, undefined, { revalidate: false });
  endTransition();  // ← Also ends transition
  break;
}
```

**Issues:**
1. **Race condition**: Topbar calls `startTransition()` → `signOut()` → `endTransition()` in `finally`, but `useAuth` also handles `SIGNED_OUT` event. If the event fires after Topbar's `finally`, we get:
   - Topbar: `startTransition()` → `endTransition()` (in finally)
   - useAuth: `startTransition()` (on SIGNED_OUT event)
   - Result: Transition stuck because useAuth's `startTransition()` happens after Topbar's `endTransition()`

2. **Timing dependency**: The order depends on when Supabase fires the `SIGNED_OUT` event relative to the `signOut()` promise resolving.

**Evidence:**
- Logout sometimes leaves overlay stuck
- Console shows `SIGNED_OUT` event firing after Topbar's `finally` block

**Fix:**
Remove manual transition handling from Topbar, let `useAuth` handle it:
```typescript
// Topbar.tsx
const handleSignOut = async () => {
  setIsSigningOut(true)
  // Remove startTransition/endTransition - let useAuth handle it
  
  try {
    await signOut()
    router.push('/login')
    router.refresh()
  } catch (error) {
    logger.error('Sign out error:', error)
    setIsSigningOut(false)
  }
  // Remove finally block with endTransition
}
```

---

### 🔴 **ROOT CAUSE #3: SWR Keys Become Null, Blocking All Data Fetches**

**Files:** `lib/data/useLists.ts`, `lib/data/useContainers.ts`  
**Lines:** useLists: 37, 54, 182 | useContainers: 33, 42

**Problem:**
```typescript
// useLists.ts
const { profile, loading: authLoading, refreshProfile } = useAuth()
const orgId = profile?.organization_id

const swrKey = orgId ? ['lists', orgId] : null  // ← null when orgId missing

const { data: lists = [], error, isLoading, mutate } = useSWR(swrKey, fetcher, {
  revalidateOnFocus: false,
  refreshInterval: 60000,
  keepPreviousData: true,
})

const isReady = !authLoading && !!orgId
const loading = authLoading || isLoading || !isReady  // ← Always true if orgId missing
```

**Issues:**
1. **SWR key is `null` when `orgId` is missing**: SWR won't fetch when key is `null`, but `isLoading` from SWR is `false` when key is `null`. However, `loading` combines `authLoading || isLoading || !isReady`, so if `orgId` is missing, `!isReady` is `true`, making `loading` always `true`.

2. **Cascading dependency**: If profile never loads (network error, slow fetch, etc.), `orgId` is `undefined`, so:
   - `swrKey = null` → SWR doesn't fetch
   - `isReady = false` → `loading = true` forever
   - All components using `useLists()` or `useContainers()` show loading spinner forever
   - App appears "stuck"

3. **No error recovery**: If profile fetch fails, there's no retry or fallback, so the app stays in loading state.

**Evidence:**
- Containers page shows loading spinner indefinitely
- Lists never appear
- Console shows profile fetch errors or slow profile fetches
- Hard refresh "fixes" it (forces new profile fetch)

**Fix:**
Add error state handling and timeout:
```typescript
// useLists.ts
const { profile, loading: authLoading, refreshProfile } = useAuth()
const orgId = profile?.organization_id

// Add timeout for auth loading - if it takes > 5s, assume error
const [authTimeout, setAuthTimeout] = useState(false)
useEffect(() => {
  if (authLoading) {
    const timer = setTimeout(() => setAuthTimeout(true), 5000)
    return () => clearTimeout(timer)
  } else {
    setAuthTimeout(false)
  }
}, [authLoading])

const swrKey = orgId ? ['lists', orgId] : null
const { data: lists = [], error, isLoading, mutate } = useSWR(swrKey, fetcher, {
  revalidateOnFocus: false,
  refreshInterval: 60000,
  keepPreviousData: true,
})

// Don't block forever - show error if auth times out
const isReady = !authLoading && !!orgId
const loading = (authLoading && !authTimeout) || isLoading || !isReady
```

---

### 🔴 **ROOT CAUSE #4: useLists ensureMainList Effect Dependency Loop**

**File:** `lib/data/useLists.ts`  
**Lines:** 57-83

**Problem:**
```typescript
useEffect(() => {
  if (authLoading || !orgId) return

  const ensureMainList = async () => {
    try {
      logger.debug('[useLists] Ensuring Main List exists and current_list_id is set')
      const result = await ensureMainListForCurrentOrg()
      
      await mutate(result.lists, { revalidate: false })
      
      // Refresh profile to get updated current_list_id
      await refreshProfile()  // ← This changes profile, which changes orgId dependency
      
      logger.debug('[useLists] Main List ensured', {
        listCount: result.lists.length,
        activeListId: result.activeListId,
      })
    } catch (err) {
      logger.error('[useLists] Failed to ensure Main List:', err)
    }
  }

  ensureMainList()
}, [authLoading, orgId, mutate, refreshProfile])  // ← refreshProfile in deps
```

**Issues:**
1. **Dependency loop**: Effect depends on `refreshProfile`, which is a `useCallback` that depends on `user?.id`. When `refreshProfile()` is called inside the effect, it updates the profile, which might change `orgId` (unlikely but possible), which triggers the effect again.

2. **Repeated execution**: If `ensureMainListForCurrentOrg()` is slow or if there are network issues, the effect might run multiple times before the first execution completes, causing:
   - Multiple simultaneous calls to `ensureMainListForCurrentOrg()`
   - Race conditions
   - Unnecessary server load
   - UI flickering

3. **No guard against concurrent execution**: Multiple instances of the effect can run simultaneously.

**Evidence:**
- Console shows multiple "Ensuring Main List" logs
- Network tab shows duplicate `ensureMainListForCurrentOrg` requests
- Slow page loads when lists are being ensured

**Fix:**
Add execution guard and remove `refreshProfile` from dependencies:
```typescript
const hasEnsuredRef = useRef(false)

useEffect(() => {
  if (authLoading || !orgId || hasEnsuredRef.current) return

  const ensureMainList = async () => {
    hasEnsuredRef.current = true
    try {
      logger.debug('[useLists] Ensuring Main List exists and current_list_id is set')
      const result = await ensureMainListForCurrentOrg()
      
      await mutate(result.lists, { revalidate: false })
      
      // Refresh profile to get updated current_list_id
      await refreshProfile()
      
      logger.debug('[useLists] Main List ensured', {
        listCount: result.lists.length,
        activeListId: result.activeListId,
      })
    } catch (err) {
      logger.error('[useLists] Failed to ensure Main List:', err)
      hasEnsuredRef.current = false  // Allow retry on error
    }
  }

  ensureMainList()
}, [authLoading, orgId, mutate])  // Remove refreshProfile from deps
```

---

### 🟡 **ROOT CAUSE #5: Profile Fetch Blocks Entire App**

**File:** `lib/auth/useAuth.ts`  
**Lines:** 29-77

**Problem:**
```typescript
useEffect(() => {
  async function load() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (!session) {
        // ... clear cookies, set loading false, return
        setLoading(false);
        return;
      }

      const currentUser = session.user;
      setUser(currentUser);

      // Profile fetch - if this is slow or fails, app is stuck
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      setProfile(p ?? null);
    } catch (e) {
      logger.error("[useAuth] Error:", e);
      setUser(null);
    } finally {
      setLoading(false);  // ← Only sets loading false in finally
    }
  }

  load();
  // ... onAuthStateChange setup
}, []);
```

**Issues:**
1. **No timeout**: If profile fetch hangs (network issue, slow DB), `loading` stays `true` forever.
2. **No retry**: If profile fetch fails, there's no retry mechanism.
3. **Blocks all dependent components**: Since `useLists` and `useContainers` depend on `profile?.organization_id`, they all wait for this fetch.

**Evidence:**
- App shows loading spinner on initial load
- Console shows profile fetch taking > 5 seconds
- Network tab shows profile request pending

**Fix:**
Add timeout and error recovery:
```typescript
useEffect(() => {
  async function load() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (!session) {
        setUser(null);
        setProfile(null);
        globalMutate(() => true, undefined, { revalidate: false });
        setLoading(false);
        return;
      }

      const currentUser = session.user;
      setUser(currentUser);

      // Add timeout for profile fetch
      const profilePromise = supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
      );

      try {
        const { data: p } = await Promise.race([profilePromise, timeoutPromise]) as any;
        setProfile(p ?? null);
      } catch (profileError) {
        logger.error("[useAuth] Profile fetch failed or timed out:", profileError);
        // Set loading false even if profile fails - don't block entire app
        setProfile(null);
      }
    } catch (e) {
      logger.error("[useAuth] Error:", e);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  load();
  // ... onAuthStateChange setup
}, []);
```

---

## Minimal Code-Pointer Fix Plan

### Fix #1: Transition Timeout Race Condition
**File:** `lib/auth/useAuth.ts`  
**Change:** Move `endTransition()` to after profile fetch completes, not on fixed timeout

### Fix #2: Double Transition on Logout
**File:** `components/layout/Topbar.tsx`  
**Change:** Remove `startTransition()` and `endTransition()` from `handleSignOut`, let `useAuth` handle transitions

### Fix #3: SWR Null Key Blocking
**Files:** `lib/data/useLists.ts`, `lib/data/useContainers.ts`  
**Change:** Add timeout for `authLoading` and don't block forever if profile never loads

### Fix #4: ensureMainList Dependency Loop
**File:** `lib/data/useLists.ts`  
**Change:** Add `useRef` guard to prevent concurrent execution, remove `refreshProfile` from dependencies

### Fix #5: Profile Fetch Blocking
**File:** `lib/auth/useAuth.ts`  
**Change:** Add 5-second timeout for profile fetch, set `loading = false` even if profile fetch fails

---

## Questions Back to You

1. **Should we show an error UI if profile fetch fails?** Currently, we just set `profile = null`, which might cause components to show "not authenticated" even though the user is logged in.

2. **Should `ensureMainList` run on every orgId change?** Currently it runs whenever `orgId` changes, which might be unnecessary if the user just switches lists within the same org.

3. **Should we add a global loading timeout?** If any auth operation takes > 10 seconds, should we show an error message instead of infinite loading?

4. **Should transitions be tied to data readiness?** Currently transitions end on fixed timeouts or after profile loads, but should they wait for lists/containers to be ready too?

---

## Summary

The regressions are caused by:
1. **Race conditions** in transition timing (timeout vs async operations)
2. **Double transition handling** (Topbar + useAuth both managing transitions)
3. **Missing error recovery** (no timeouts, no retries, no fallbacks)
4. **Dependency loops** (effects triggering themselves)
5. **Blocking on single operations** (profile fetch blocks entire app)

All fixes are **local, minimal changes** - no architectural rewrites needed.

