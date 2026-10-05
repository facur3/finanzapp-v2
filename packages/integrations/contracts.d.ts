export class InputError extends Error {}
export interface CaptureDraft {
  kind: 'expense' | 'income' | null; amountMinor: number | null; currency: 'ARS' | 'USD' | null;
  merchant: string | null; category: string | null; dateISO: string | null; paymentMethodRef: string | null;
}
export interface CaptureRequest { version: 1; requestId: string; source: 'shortcut' | 'assistant'; draft: CaptureDraft }
/** A local ledger aggregate the device sends with a question (Assistant protocol v2, `assistant-protocol.js`). */
export interface AssistantFact { id: string; label: string; amountMinor: number; count: number; startISO: string; endISO: string }
export function isDate(value: unknown): boolean;
export function validateDraft(value: unknown): CaptureDraft;
export function validateCapture(value: unknown): CaptureRequest;
