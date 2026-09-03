import { createHash } from "node:crypto";

/**
 * Stable content hash of a single file's diff text, used to detect when a file
 * changed since the reviewer last marked it "Viewed" (GitHub-style
 * auto-uncheck on re-review). Computed server-side from the stored patch so the
 * browser never needs SubtleCrypto in its render path.
 */
export function hashFileDiff(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
