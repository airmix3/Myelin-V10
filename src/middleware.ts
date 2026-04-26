/**
 * Next.js middleware — route protection for onboarding.
 *
 * Runs in Edge Runtime (no fs access). Uses cookie-based detection:
 * - If `onboarding_complete` cookie is NOT set, redirect all Cortex routes to /onboarding.
 * - Always allow /onboarding, /command-book, /api, /_next, /avatars, /favicon.ico through.
 *
 * The cookie is set by:
 * - GET /onboarding/api/state (for existing installations detecting completion)
 * - POST /onboarding/api/complete (after Phase 9 graduation)
 *
 * Per D-04: All Cortex routes redirect to /onboarding until graduation.
 * Per D-07: Middleware at src/middleware.ts handles redirection.
 */

import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Always allow these paths through
  if (
    path.startsWith('/onboarding') ||
    path.startsWith('/command-book') ||
    path.startsWith('/api') ||
    path.startsWith('/_next') ||
    path === '/favicon.ico' ||
    path.startsWith('/avatars')
  ) {
    return NextResponse.next();
  }

  // Phase 8 bypass: allow Cortex access when ?onboarding=true query param is present.
  // The DemoTask component adds this param when redirecting to the Cortex during
  // the onboarding demo task (Phase 8 System Orientation).
  if (request.nextUrl.searchParams.get('onboarding') === 'true') {
    return NextResponse.next();
  }

  // Check cookie — set by server in state/completion API routes
  const onboardingComplete = request.cookies.get('onboarding_complete')?.value === 'true';

  if (!onboardingComplete) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|avatars/).*)'],
};
