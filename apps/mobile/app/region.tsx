import { LocalePreferenceScreen } from '../src/ui/locale-preference';

/** Más → App y datos → Región (released in Producto 23.1C2): Argentina or
 * Estados Unidos, chosen independently of the language. Más hides the row in
 * a build with a single released region. */
export default function RegionScreen() {
  return <LocalePreferenceScreen kind="region" />;
}
