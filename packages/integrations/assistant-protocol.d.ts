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
/** The figures of a reply's prose that the request does not hold (a fact's amount or count, a period's year, a day-sized
 * integer, a number the person or a label wrote): each is a reason to refuse a reply to a question. */
export declare function unsupportedFigures(message: string, request: Pick<AssistantRequestV2, 'facts'> & Partial<Pick<AssistantRequestV2, 'text' | 'todayISO'>>): string[];
export declare const ASSISTANT_RESULT_SCHEMA: Readonly<Record<string, unknown>>;
