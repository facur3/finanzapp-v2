import { assistantForEnvironment, type AssistantClient } from './client.ts';
import { fixtureAssistant } from './fixtures.ts';

declare const __DEV__: boolean | undefined;

/** The one place that decides which Assistant client a build gets.
 *
 * Production and every default development bundle: `assistantForEnvironment`
 * with no session provider, which is `disconnected` today (there is no mobile
 * sign-in yet). Fixtures are reachable only from a development bundle started
 * with `EXPO_PUBLIC_ASSISTANT_FIXTURES=1`, so the scripted replies can be seen
 * on the iPhone; a release bundle ignores the flag. Nothing here reads a key:
 * the model key stays on the server. */
export function assistantForBuild(env: Record<string, string | undefined> = process.env, dev: boolean = typeof __DEV__ !== 'undefined' && __DEV__): AssistantClient {
  if (dev && env.EXPO_PUBLIC_ASSISTANT_FIXTURES === '1') return fixtureAssistant();
  return assistantForEnvironment(env);
}
