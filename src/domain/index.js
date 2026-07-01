// Domain barrel. Two jobs:
//  1) Re-export pure helpers for Vitest (ES module imports).
//  2) Expose them on `window.FinanzDomain` so the (non-module) x-dc component in
//     index.html can call into them. This module is loaded as a deferred
//     <script type="module"> in the <head>, so it runs BEFORE DOMContentLoaded
//     (when support.js boots the component), guaranteeing availability at first render.
import * as money from './money.js';
import * as transactions from './transactions.js';
import * as balances from './balances.js';
import * as dates from './dates.js';
import * as reports from './reports.js';

const FinanzDomain = { ...money, ...transactions, ...balances, ...dates, ...reports };

if (typeof window !== 'undefined') window.FinanzDomain = FinanzDomain;

export { money, transactions, balances, dates, reports };
export default FinanzDomain;
