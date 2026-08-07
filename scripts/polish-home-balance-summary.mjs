#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/app/template.html';
let source = readFileSync(path, 'utf8');

function replaceOnce(oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, got ${count}`);
  source = source.replace(oldText, newText);
}

replaceOnce(
  '        <div class="fa-hero-balance" onClick="{{ toggleHeroCurrency }}" style="display:flex;align-items:flex-end;margin-bottom:7px;cursor:pointer;animation: {{ heroAnimName }} .42s cubic-bezier(.22,1,.36,1);">',
  '        <div class="fa-hero-balance" onClick="{{ toggleHeroCurrency }}" aria-label="Cambiar moneda del saldo" style="display:flex;align-items:flex-end;margin-bottom:16px;cursor:pointer;animation: {{ heroAnimName }} .42s cubic-bezier(.22,1,.36,1);">',
  'hero spacing',
);

replaceOnce(
  '        <div style="font-size:12.5px;font-weight:500;color:var(--text-3);margin-bottom:18px;line-height:1.4;">{{ heroSub }}</div>\n\n',
  '',
  'remove verbose hero helper',
);

replaceOnce(
`        <!-- Calm monthly context: no extra pills competing with the balance. -->
        <div class="fa-home-flows" style="display:flex;align-items:center;gap:18px;margin-bottom:24px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:12px;font-weight:500;color:var(--text-2);">Ingresos</span>
            <span style="font-size:13px;font-weight:700;color:var(--pos);">{{ ingresosStr }}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:12px;font-weight:500;color:var(--text-2);">Gastos</span>
            <span style="font-size:13px;font-weight:700;">{{ gastosStr }}</span>
          </div>
        </div>
`,
`        <!-- Compact monthly context: useful at a glance without competing with the balance. -->
        <div class="fa-home-flows" style="display:inline-flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--hairline);border-radius:999px;padding:7px 11px;margin-bottom:24px;box-shadow:var(--shadow-pill);">
          <div style="display:flex;align-items:center;gap:5px;white-space:nowrap;">
            <span style="font-size:11.5px;font-weight:600;color:var(--text-2);">Ingresos</span>
            <span style="font-size:12px;font-weight:750;color:var(--pos);">{{ ingresosStr }}</span>
          </div>
          <span aria-hidden="true" style="width:1px;height:14px;background:var(--hairline);display:block;"></span>
          <div style="display:flex;align-items:center;gap:5px;white-space:nowrap;">
            <span style="font-size:11.5px;font-weight:600;color:var(--text-2);">Gastos</span>
            <span style="font-size:12px;font-weight:750;">{{ gastosStr }}</span>
          </div>
        </div>
`,
  'compact flows pill',
);

writeFileSync(path, source);
console.log('Polished home balance summary.');
