/** Error messages in the reader's language. The ledger, the domain and the
 * storage layer throw Spanish sentences, and forms keep what they caught as a
 * string; translation happens when the message is shown (`ErrorMessage`), so
 * an error already on screen follows a language change like any other label.
 * A form's own message is stored as its catalogue key ("entryForm.futureDate");
 * a thrown message is recognised by its exact Spanish text in `errors.*`.
 * Anything else (a message from a part of the app not yet translated) is
 * shown as it was thrown, never blank. Pure: no React, no device access. */
import { es } from './messages/es/index.ts';
import { translate, type MessageKey } from './messages.ts';
import type { LanguageCode } from './locale.ts';

const known = new Map<string, MessageKey>();
for (const [group, messages] of Object.entries(es.errors)) {
  for (const [name, text] of Object.entries(messages)) known.set(text, `errors.${group}.${name}` as MessageKey);
}

const KEY = /^[a-z][a-zA-Z]*(\.[a-zA-Z0-9]+)+$/;

export function localizeError(language: LanguageCode, message: string): string {
  if (!message) return message;
  if (KEY.test(message)) {
    const text = translate(language, message as MessageKey);
    if (text !== message) return text;
  }
  const key = known.get(message);
  return key ? translate(language, key) : message;
}
