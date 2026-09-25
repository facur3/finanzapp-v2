import { LocaleChooser } from '../src/ui/locale-choosers';

/** Más → App y datos → Región: the released regions (Argentina and Estados
 * Unidos; every catalogue region in a development preview, 24R2A), chosen
 * independently of the language, drawn by `ChoiceScreen`. Más hides the row in
 * a build with a single released region. */
export default function RegionScreen() {
  return <LocaleChooser kind="region" />;
}
