// The currencies a new account, card, debt, budget or recurring rule can be created in: the domain's creation gate,
// re-exported by currency.ts (`isLedgerCurrency`) and read as is by the Assistant protocol on the server
// (packages/integrations/assistant-protocol.js), which is plain JavaScript and cannot load the catalogue. Plain data,
// no import, so both sides read one list. currency.test.ts compares it with the catalogue.
/** The currencies an account, a card, a debt, a budget or a recurring rule can be created in.
 * This list gates **creation only**; reading a stored row never consults it (`isStorableCurrency`).
 * ARS and USD since the beginning; since Producto 24M every `ready` fiat currency whose ISO minor
 * unit is 0 or 2 (144 more: docs/currency.md §2.7), in code order after ARS and USD. The list is
 * written out, not derived, so a catalogue update never opens a currency by itself: a test compares it
 * with the catalogue and fails until the change is reviewed. The three-decimal currencies wait in
 * `HELD_CURRENCIES`. */
export const LEDGER_CURRENCIES = Object.freeze(['ARS', 'USD',
  'AED', 'AFN', 'ALL', 'AMD', 'AOA', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF',
  'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ',
  'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IRR', 'ISK', 'JMD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF',
  'KPW', 'KRW', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP',
  'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'PAB', 'PEN', 'PGK',
  'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP',
  'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH',
  'UGX', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XCG', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWG',
]);
