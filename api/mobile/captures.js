import { createMobileHandler } from '../../server/mobile/handlers.js';
import { mobileDependencies } from '../../server/mobile/runtime.js';
export default async function handler(req, res) {
  let dependencies = null;
  try { dependencies = mobileDependencies('capture'); } catch { /* Fail closed on incomplete configuration. */ }
  return createMobileHandler('capture', dependencies)(req, res);
}
