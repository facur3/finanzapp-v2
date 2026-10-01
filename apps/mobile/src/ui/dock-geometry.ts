/** The dock's geometry (Producto 24UX6A, decision 005), shared by the dock itself (`FloatingTabBar`) and the capture
 * hub, which draws its close control exactly where the «+» sits. Pure numbers, so Node tests read them directly.
 *
 * The dock is one object in two parts: the pine pill with the four tabs and, 10 pt to its right, the 60 pt «+». Both are
 * 60 pt tall, 16 pt from the screen's sides (plus the landscape sensor inset) and lifted into the upper part of the home
 * indicator's safe area. At 375 pt the pill's inner width leaves each tab about 65 pt; at 393 pt about 70 pt: every tab keeps a full
 * target. The dock stays in the layout (never an overlay), so every screen ends above it. */
export const DOCK = { height: 60, side: 16, top: 8, gap: 10, plus: 60 } as const;

/** The air under the dock: it rests in the upper part of the home indicator's safe area (clear of the indicator),
 * and keeps a margin on an iPhone without one. */
export function tabBarBottomGap(bottomInset: number): number {
  return bottomInset > 0 ? Math.max(bottomInset - 14, 10) : 10;
}

/** The dock's side padding: its 16 pt, plus the sensor housing's inset in landscape. */
export function dockSide(insets: { left: number; right: number }): number {
  return DOCK.side + Math.max(insets.left, insets.right);
}

/** Where the «+» sits, measured from the window's bottom-right corner: the hub's close control is drawn there. */
export function plusFrame(insets: { bottom: number; left: number; right: number }): { right: number; bottom: number; size: number } {
  return { right: dockSide(insets), bottom: tabBarBottomGap(insets.bottom) + (DOCK.height - DOCK.plus) / 2, size: DOCK.plus };
}

/** The hub card floats above the dock with a 12 pt gap, 12 pt from the sides: the dock stays visible under the scrim. */
export function hubInset(insets: { bottom: number; left: number; right: number }): { bottom: number; side: number } {
  return { bottom: tabBarBottomGap(insets.bottom) + DOCK.height + 12, side: 12 + Math.max(insets.left, insets.right) };
}
