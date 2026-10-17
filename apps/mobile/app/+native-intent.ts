/** Every URL that opens the app from outside it (another app, a web page through the custom scheme, a cold start from a
 * link) lands on Inicio: no screen, form or prefill is reachable from a link, and no link writes anything. Expo Router
 * calls this for the launch URL (to Inicio) and for each later one (ignored, the screen in front stays); navigation inside the app (`router.push`) never passes here. It
 * runs outside React and must not throw. When a producer needs an entry (a notification that opens a review), allow that
 * one path here, rebuilt from a validated id and without its query; a custom-scheme link never carries a secret. */
export function redirectSystemPath({ initial }: { path: string; initial: boolean }): string | null {
  // A link that arrives while the app is open does nothing (null: no navigation), so it never dismisses a half-filled form.
  return initial ? '/' : null;
}
