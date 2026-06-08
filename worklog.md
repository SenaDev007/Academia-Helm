---
Task ID: 1
Agent: Main Agent
Task: Fix 3 critical production issues + revise PLATFORM_OWNER tenant system

Work Log:
- Analyzed the entire multi-tenant/subdomain architecture (backend + frontend)
- Fixed PLATFORM_OWNER tenant system: removed /app/platform default redirect, always require school subdomain
- Fixed middleware: PLATFORM_OWNER without tenant is now redirected to /portal instead of allowed on /app
- Fixed navigation: SubModuleNavigation now uses <Link> instead of router.push() for client-side navigation
- Fixed sidebar: collapsed/tablet links now include ?tenant= param to avoid middleware redirects
- Fixed login 500 error: added preValidatedUser to avoid double bcrypt.compare, added comprehensive error logging
- Fixed post-auth loading: when staying on same subdomain, use router.push() instead of window.location.href
- Updated auth.service.ts backend: PLATFORM_OWNER can now login with tenant_id to get enriched token directly
- Updated BFF login route: handles tenant from backend response, supports isPlatformOwner flag
- Updated portal page: PLATFORM portal card now requires school selection before continuing
- Migration already handled: publishedAt column ensured via fallback SQL in main.ts

Stage Summary:
- All 3 critical production issues addressed
- PLATFORM_OWNER now always works within a school's professional subdomain
- Navigation performance significantly improved (client-side routing, proper Link usage)
- Login error handling and logging improved for better debugging
- TypeScript compilation passes (pre-existing errors in unrelated files)
