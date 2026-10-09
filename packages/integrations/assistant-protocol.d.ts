import type { AssistantFact } from './contracts.js';
/** The version a client sends today (v3: v2 plus the reply `language`); the server accepts every version listed. */
export declare const ASSISTANT_PROTOCOL_VERSION: 3;
export declare const ASSISTANT_PROTOCOL_VERSIONS: readonly [2, 3];
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
/** v2 plus `language`: the interface language the reply is written in (ISO 639-1, two lowercase letters). The region
 * stays what it was, a regional currency word's only key; it never decides the reply's language. */
export interface AssistantRequestV3 extends Omit<AssistantRequestV2, 'version'> {
  version: 3; language: string;
}
export type AssistantRequest = AssistantRequestV2 | AssistantRequestV3;
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
/** Accepts v2 and v3 and returns the wire shape of the version received. */
export declare function validateAssistantRequest(value: unknown): AssistantRequest;
export declare function modelInput(request: AssistantRequest): Omit<AssistantRequestV2, 'version' | 'requestId'> & { language?: string };
export declare function validateAssistantResultV2(value: unknown, request: AssistantRequest): AssistantResultV2;
/** The optional names the server boundary may drop when a model copies them past their bound (25A-06, decision A). */
export type DroppableField = 'merchant' | 'category';
export declare const DROPPABLE_FIELDS: readonly DroppableField[];
/** The server's one recovery of a refused output: a proposal whose only fault is an over-long optional name comes back
 * validated with that name null and listed; anything else is thrown as the validator threw it; a valid output is
 * returned unchanged with `dropped` empty. */
export declare function recoverAssistantResultV2(value: unknown, request: AssistantRequest): { result: AssistantResultV2; dropped: DroppableField[] };
/** The `dropped` list a server reply carries beside the result; absent is none. */
export declare function validateDroppedFields(value: unknown, result: AssistantResultV2): DroppableField[];
export declare const ASSISTANT_RESULT_SCHEMA: Readonly<Record<string, unknown>>;
