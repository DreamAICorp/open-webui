export const HERMES_COCKPIT_ORIGIN = 'https://agency.dev.4u-corp.com';

/** Recognize the embedding application across native chat navigations. */
export function isHermesCockpitFrame(): boolean {
 if (typeof window === 'undefined' || window.parent === window) return false;
 // Chromium/WebKit retain the actual parent origin when referrer changes.
 const ancestors = window.location.ancestorOrigins;
 if (ancestors?.length) return ancestors[0] === HERMES_COCKPIT_ORIGIN;
 try { if (new URL(document.referrer).origin === HERMES_COCKPIT_ORIGIN) return true; } catch {}
 // Set only after the exact-origin/source authentication handshake succeeds.
 return sessionStorage.getItem('hermes:embedded-cockpit-origin') === HERMES_COCKPIT_ORIGIN;
}
