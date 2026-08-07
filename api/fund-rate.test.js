import { describe, expect, it } from 'vitest';
import { parseEstimatedAnnualRate } from './fund-rate.js';

describe('Cocos estimated rate parser', () => {
  it('reads a comma-decimal estimated annual rate without treating it as realized return', () => {
    expect(parseEstimatedAnnualRate('<h4>Rendimiento anual estimado</h4><div>20,03%</div>')).toBe(20.03);
  });

  it('returns zero when the official label is absent', () => {
    expect(parseEstimatedAnnualRate('<div>20,03%</div>')).toBe(0);
  });
});
