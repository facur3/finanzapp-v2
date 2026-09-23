import { LocalePreferenceScreen } from '../src/ui/locale-preference';

/** Más → App y datos → Región. Built in Producto 23.1A; Más links it only once
 * a second region is released (23.1C), so until then it lists Argentina alone
 * and is reachable only by its route. */
export default function RegionScreen() {
  return <LocalePreferenceScreen kind="region" />;
}
