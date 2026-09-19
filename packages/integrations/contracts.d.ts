export class InputError extends Error {}
export interface CaptureDraft {
  kind: 'expense' | 'income' | null; amountMinor: number | null; currency: 'ARS' | 'USD' | null;
  merchant: string | null; category: string | null; dateISO: string | null; paymentMethodRef: string | null;
}
export interface CaptureRequest { version: 1; requestId: string; source: 'shortcut' | 'assistant'; draft: CaptureDraft }
export interface AssistantFact { id: string; label: string; amountMinor: number; count: number; startISO: string; endISO: string }
export interface AssistantRequest { version: 1; action: 'parse' | 'explain'; text: string; todayISO: string; currency: 'ARS' | 'USD'; facts: AssistantFact[] }
export interface AssistantResult { kind: 'draft' | 'answer' | 'clarification'; message: string; draft: CaptureDraft | null; factIds: string[] }
export function isDate(value: unknown): boolean;
export function validateDraft(value: unknown): CaptureDraft;
export function validateCapture(value: unknown): CaptureRequest;
export function validateAssistantRequest(value: unknown): AssistantRequest;
export function validateAssistantResult(value: unknown, request: AssistantRequest): AssistantResult;
