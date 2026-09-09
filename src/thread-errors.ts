/** Missing BB workers are recoverable; permission and connection failures are not. */
export function isMissingThread(error: unknown): boolean {
  return (error as { status?: number } | null)?.status === 404 || String(error).includes("HTTP 404: Thread not found");
}
