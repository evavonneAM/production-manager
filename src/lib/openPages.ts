import type { Profile } from '../auth/AuthProvider'

/**
 * Pages everyone can use while the rest of the app is still being built.
 * Testers (users.is_tester) see every page. To open a page to the whole team,
 * add its path here.
 */
export const OPEN_PAGES = ['/tools', '/profile']

/** Where people land: the first open page, or My Work for testers. */
export function homePath(profile: Profile | null): string {
  return !profile || profile.is_tester ? '/my-work' : OPEN_PAGES[0]
}

/** True when this person can see the page at `path` (and anything under it). */
export function canSeePage(profile: Profile | null, path: string): boolean {
  if (!profile || profile.is_tester) return true
  return OPEN_PAGES.some((p) => path === p || path.startsWith(`${p}/`))
}
