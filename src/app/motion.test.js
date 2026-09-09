import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./finanzapp.css', import.meta.url), 'utf8');
const component = readFileSync(new URL('./component.js', import.meta.url), 'utf8');

describe('navigation motion', () => {
  it('keeps pushed screens opaque and covers the translated edge', () => {
    expect(css).toContain('.fa-screen{will-change:transform,opacity;backface-visibility:hidden;-webkit-backface-visibility:hidden;box-shadow:-64px 0 0 var(--bg)}');
    expect(css).toMatch(/@keyframes faPushIn\{[^}]*transform:[^}]*\}/);
    expect(css).not.toMatch(/@keyframes faPushIn\{[^}]*opacity:/);
    expect(css).not.toMatch(/@keyframes faPushOut\{[^}]*opacity:/);
    expect(css).not.toMatch(/@keyframes faModalIn\{[^}]*opacity:/);
    expect(css).not.toMatch(/@keyframes faModalOut\{[^}]*opacity:/);
  });

  it('does not fade tab content to zero during a section change', () => {
    for (const name of ['faTabLeaveNext', 'faTabLeavePrev', 'faTabEnterNext', 'faTabEnterPrev']) {
      const keyframes = css.match(new RegExp(`@keyframes ${name}\\{[^}]*\\}`));
      expect(keyframes?.[0]).toBeTruthy();
      expect(keyframes?.[0]).not.toContain('opacity:0');
    }
  });

  it('ignores incidental edge movement before tracking a back swipe', () => {
    expect(component).toContain('deadZone=18');
    expect(component).toContain('visualDx=Math.max(0,dx-deadZone)');
  });
});
