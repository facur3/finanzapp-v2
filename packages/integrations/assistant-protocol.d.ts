import type { AssistantFact } from './contracts.js';
export declare const ASSISTANT_PROTOCOL_VERSION: 2;
export type ResultType = 'answer' | 'proposal' | 'clarification' | 'out_of_scope';
export type ProposalKind = 'expense' | 'income';
export type ProtocolCurrency = 'ARS' | 'USD';
export type ClarificationField = 'kind' | 'amount' | 'currency' | 'date' | 'merchant' | 'category' | 'destination' | 'period';
export type NavigationTarget = 'movements' | 'category' | 'budget';
export declare const RESULT_TYPES: readonly ResultType[];
export declare const PROPOSAL_KINDS: readonly ProposalKind[];
export declare const PROTOCOL_CURRENCIES: readonly ProtocolCurrency[];
export declare const CLARIFICATION_FIELDS: readonly ClarificationField[];
export declare const NAVIGATION_TARGETS: readonly NavigationTarget[];
export declare const PROTOCOL_LIMITS: Readonly<{
  requestBytes: number; requestId: RegExp; textChars: number; facts: number; factIdChars: number; factLabelChars: number;
  messageChars: number; proposals: number; candidateIds: number; merchantChars: number; categoryChars: number; referenceChars: number; maxAmountMinor: number;
}>;
export interface AssistantRequestV2 {
  version: 2; requestId: string; action: 'parse' | 'explain'; text: string; todayISO: string; currency: ProtocolCurrency; region: string; facts: AssistantFact[];
}
/** Financial facts only; every unknown is null. No account or card id: `paymentMethodRef` is the person's words. */
export interface ProposalDraft {
  kind: ProposalKind; amountMinor: number | null; currency: ProtocolCurrency | null; merchant: string | null; category: string | null;
  dateISO: string | null; paymentMethodRef: string | null;
}
export interface NavigationIntent { target: NavigationTarget; factId: string }
export interface Clarification { field: ClarificationField; candidateIds: string[] }
export interface AssistantResultV2 {
  type: ResultType; message: string; evidenceIds: string[]; navigation: NavigationIntent | null; proposals: ProposalDraft[]; clarification: Clarification | null;
}
export declare function isSafeInputText(value: unknown, max: number): boolean;
export declare function isSafeModelText(value: unknown, max: number, prose?: boolean): boolean;
export declare function validateAssistantRequestV2(value: unknown): AssistantRequestV2;
export declare function modelInput(request: AssistantRequestV2): Omit<AssistantRequestV2, 'version' | 'requestId'>;
export declare function validateAssistantResultV2(value: unknown, request: AssistantRequestV2): AssistantResultV2;
/** The figures of a reply's prose that the cited facts (`evidenceIds`) do not hold exactly (an amount in minor units
 * or a count, a period's year, a number in a cited label, a day-sized integer): each is a reason to refuse a reply to a
 * question. Nothing else supports a figure: not an uncited fact, not the person's question. */
export declare function unsupportedFigures(message: string, request: Pick<AssistantRequestV2, 'facts'> & Partial<Pick<AssistantRequestV2, 'todayISO' | 'currency'>>, evidenceIds?: readonly string[]): string[];
/** Every ISO 4217 code the figure reader treats as a currency mark: the domain's catalogue, pinned by a drift test. */
export declare const ISO_CURRENCY_CODES: readonly string[];
/** The exact minor-unit value of a figure token written under the reply's numeric contract (Argentine writing: a point
 * groups thousands, a comma precedes one or two centavos), under a multiplier suffix («mil», «millones»): one value, or
 * none when the writing is not the contract's. */
export declare function figureMinorUnits(token: string, suffix?: string): bigint[];
export declare const ASSISTANT_RESULT_SCHEMA: Readonly<Record<string, unknown>>;
