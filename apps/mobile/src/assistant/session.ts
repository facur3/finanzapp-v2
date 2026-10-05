import { conversationReducer, emptyConversation, type ConversationAction, type ConversationState } from './conversation.ts';

/** The Assistant's one conversation for the life of the app process (Producto 24UX6A, decision 005).
 *
 * Until 24UX6A the conversation lived in the Assistant tab's own state and survived only because the tab root stayed
 * mounted. The Assistant is now a screen of the root stack, opened from the capture hub, so leaving it unmounts the
 * screen; the conversation moves here, into memory, so leaving and coming back in the same app session finds it as it
 * was, including an answer that kept streaming or a proposal's capture that finished while the screen was closed (the
 * request and the capture dispatch here, not into a component that may be gone).
 *
 * Memory only, on purpose: nothing of the conversation is written to SQLite, a backup or a preference, and closing the
 * app clears it, as before. Chat history is not a FinanzApp feature (conversation.ts). Since 25A-04 a financial proposal
 * is not the conversation's: it is captured into the review store (its own file) and lives there, so New chat, leaving
 * the screen or closing the app never removes it. Nothing here writes the ledger.
 *
 * Pure (no React, no React Native), so Node tests drive it directly. */
export type SessionState = {
  conversation: ConversationState;
};

export type ConversationSession = {
  getState: () => SessionState;
  subscribe: (listener: () => void) => () => void;
  dispatch: (action: ConversationAction) => void;
  /** The request in flight, if any: at most one; Stop and New chat abort it. */
  request: { current: AbortController | null };
  /** 25A-04: the proposals whose capture is in flight, so one is never sent twice at once. */
  capturing: Set<string>;
  /** 25A-04: how the Assistant in front presents the review sheet for a stored item, or null when no Assistant is in front
   * (or one sheet was just presented). Registered by the focused screen, so a capture that lands after the screen was
   * left and reopened reaches the screen now in front, never a closed one. Taking it clears it: one sheet at a time. */
  presenter: { current: ((itemId: string) => void) | null };
  /** Forget the conversation (New chat): aborts a request in flight and keeps the message ids increasing. It never touches
   * the review store: a captured proposal stays in «Para revisar». */
  reset: () => void;
};

export function createConversationSession(): ConversationSession {
  let state: SessionState = { conversation: emptyConversation };
  const listeners = new Set<() => void>();
  const set = (next: SessionState) => {
    if (next === state) return;
    state = next;
    for (const listener of [...listeners]) listener();
  };
  const session: ConversationSession = {
    getState: () => state,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispatch: action => {
      const conversation = conversationReducer(state.conversation, action);
      if (conversation !== state.conversation) set({ ...state, conversation });
    },
    request: { current: null },
    capturing: new Set(),
    presenter: { current: null },
    reset: () => {
      session.request.current?.abort();
      session.request.current = null;
      session.dispatch({ type: 'stop' });
      session.dispatch({ type: 'reset' });
    },
  };
  return session;
}

let shared: ConversationSession | null = null;
/** The app's one session, created on first use. */
export function conversationSession(): ConversationSession {
  return shared ??= createConversationSession();
}

/** The person's last words in the current conversation, for the capture hub's «Continuar» line; null when there is no
 * exchange to continue (nothing was said yet, or New chat cleared it). Never invented: only what was actually sent. */
export function lastUserWords(conversation: ConversationState): string | null {
  const last = conversation.messages.findLast(message => message.role === 'user');
  return last?.role === 'user' && last.text.trim() ? last.text : null;
}
