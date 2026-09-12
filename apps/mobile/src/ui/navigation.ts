// For the three pilot tabs only, not the native detail/modal stack.
// Keeping them mounted costs some memory; the movement list remains virtualized.
// Expo Router's JS fade otherwise controls both opacity and native activityState.
// A zero-opacity/inactive destination must never depend on animation completion.
export const tabHostOptions = { detachInactiveScreens: false } as const;
export const tabScreenOptions = { animation: 'none', lazy: false, freezeOnBlur: false } as const;
