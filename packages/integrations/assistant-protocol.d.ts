import type { AssistantFact } from './contracts.js';
import type { IsoCurrencyCode } from '../domain/currency-data.ts';
/** The version a client sends today (v4: v3's request; a proposal states `amount`, an exact decimal in major units);
 * the server accepts every version listed. */
export declare const ASSISTANT_PROTOCOL_VERSION: 4;
export declare const ASSISTANT_PROTOCOL_VERSIONS: readonly [2, 3, 4];
export type ResultType = 'answer' | 'proposal' | 'clarification' | 'out_of_scope';
export type ProposalKind = 'expense' | 'income';
/** A currency of the domain's creation gate (`LEDGER_CURRENCIES`); v2 and v3 carry ARS and USD only. Statically the
 * domain's own currency type, as the domain types its gate (`isLedgerCurrency(value): value is IsoCurrencyCode`): the
 * gate is a runtime list, and a literal union of its 146 codes here would be a second list to keep in step. The
 * validators enforce the gate. */
export type ProtocolCurrency = IsoCurrencyCode;
export type LegacyWireCurrency = 'ARS' | 'USD';
export type ClarificationField = 'kind' | 'amount' | 'currency' | 'date' | 'merchant' | 'category' | 'destination' | 'period';
export type NavigationTarget = 'movements' | 'category' | 'budget';
export declare const RESULT_TYPES: readonly ResultType[];
export declare const PROPOSAL_KINDS: readonly ProposalKind[];
export declare const PROTOCOL_CURRENCIES: readonly ProtocolCurrency[];
export declare const LEGACY_WIRE_CURRENCIES: readonly LegacyWireCurrency[];
export declare const CLARIFICATION_FIELDS: readonly ClarificationField[];
export declare const NAVIGATION_TARGETS: readonly NavigationTarget[];
export declare const PROTOCOL_LIMITS: Readonly<{
  requestBytes: number; requestId: RegExp; textChars: number; facts: number; factIdChars: number; factLabelChars: number;
  messageChars: number; proposals: number; candidateIds: number; merchantChars: number; categoryChars: number; referenceChars: number; maxAmountMinor: number;
  amountWholeDigits: number; amountFractionDigits: number;
}>;
export interface AssistantRequestV2 {
  version: 2; requestId: string; action: 'parse' | 'explain'; text: string; todayISO: string; currency: LegacyWireCurrency; region: string; facts: AssistantFact[];
}
/** v2 plus `language`: the interface language the reply is written in (ISO 639-1, two lowercase letters). The region
 * stays what it was, a regional currency word's only key; it never decides the reply's language. */
export interface AssistantRequestV3 extends Omit<AssistantRequestV2, 'version'> {
  version: 3; language: string;
}
/** v3's request; its reply states a proposal's amount as an exact decimal in major units (`ProposalDraft.amount`). */
export interface AssistantRequestV4 extends Omit<AssistantRequestV3, 'version' | 'currency'> {
  version: 4;
  /** Any currency of the domain's creation gate (the screen's: the facts' currency for a question). */
  currency: ProtocolCurrency;
}
export type AssistantRequest = AssistantRequestV2 | AssistantRequestV3 | AssistantRequestV4;
/** Financial facts only; every unknown is null. No account or card id: `paymentMethodRef` is the person's words.
 * `amount` (v4) is the number the person meant, in major units, as a canonical decimal («15000», «1.99»); the device
 * scales it to minor units once the currency is resolved. */
export interface ProposalDraft {
  kind: ProposalKind; amount: string | null; currency: ProtocolCurrency | null; merchant: string | null; category: string | null;
  dateISO: string | null; paymentMethodRef: string | null;
}
/** A proposal as a v2 or v3 client reads it: the amount in cents. */
export interface LegacyProposalDraft extends Omit<ProposalDraft, 'amount' | 'currency'> { amountMinor: number | null; currency: LegacyWireCurrency | null }
export interface NavigationIntent { target: NavigationTarget; factId: string }
export interface Clarification { field: ClarificationField; candidateIds: string[] }
export interface AssistantResultV2 {
  type: ResultType; message: string; evidenceIds: string[]; navigation: NavigationIntent | null; proposals: ProposalDraft[]; clarification: Clarification | null;
}
export declare function isSafeInputText(value: unknown, max: number): boolean;
export declare function isSafeModelText(value: unknown, max: number, prose?: boolean): boolean;
/** Accepts v2, v3 and v4 and returns the wire shape of the version received. */
export declare function validateAssistantRequest(value: unknown): AssistantRequest;
export declare function modelInput(request: AssistantRequest): Omit<AssistantRequestV2, 'version' | 'requestId'> & { language?: string };
/** A canonical decimal amount a v4 proposal may state: digits, one optional dot and up to four decimals, above zero. */
export declare function isProtocolAmount(value: unknown): value is string;
/** Validates the v4 result (what a model writes) against the request it answers, whatever the request's version. */
export declare function validateAssistantResultV2(value: unknown, request: AssistantRequest): AssistantResultV2;
/** The validated result in the request's wire shape: unchanged for v4; v2 and v3 get `amountMinor` in cents, or a throw
 * when the amount has no exact cents. */
export declare function wireResult(result: AssistantResultV2, request: AssistantRequest): AssistantResultV2 | (Omit<AssistantResultV2, 'proposals'> & { proposals: LegacyProposalDraft[] });
/** The optional names the server boundary may drop when a model copies them past their bound (25A-06, decision A). */
export type DroppableField = 'merchant' | 'category';
export declare const DROPPABLE_FIELDS: readonly DroppableField[];
/** The server's one recovery of a refused output: a proposal whose only fault is an over-long optional name the person
 * wrote (copied verbatim from `request.text`) comes back validated with that name null and listed; anything else, an
 * invented name included, is thrown as the validator threw it; a valid output is returned unchanged with `dropped` empty. */
export declare function recoverAssistantResultV2(value: unknown, request: AssistantRequest): { result: AssistantResultV2; dropped: DroppableField[] };
/** The `dropped` list a server reply carries beside the result; absent is none. */
export declare function validateDroppedFields(value: unknown, result: AssistantResultV2): DroppableField[];
export declare const ASSISTANT_RESULT_SCHEMA: Readonly<Record<string, unknown>>;
