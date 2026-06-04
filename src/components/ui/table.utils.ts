/** Pure helper for Table / DataTable empty-state visibility */
export function shouldShowTableEmptyState(
  loading: boolean | undefined,
  childCount: number,
): boolean {
  return !loading && childCount === 0;
}
