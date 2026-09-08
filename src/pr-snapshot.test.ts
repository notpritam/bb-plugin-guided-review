import { expect, test, vi } from "vitest";
import { readPrSnapshot } from "./pr-snapshot";

const pr = { headRefOid: "old", title: "Change", baseRefName: "main", headRefName: "feature", url: "https://github.com/acme/web/pull/7" };
test("a commit pushed while fetching the diff cannot be saved under the previous head", async () => {
  const run = vi.fn()
    .mockResolvedValueOnce({ code: 0, stdout: JSON.stringify(pr), stderr: "" })
    .mockResolvedValueOnce({ code: 0, stdout: "a diff", stderr: "" })
    .mockResolvedValueOnce({ code: 0, stdout: JSON.stringify({ headRefOid: "new" }), stderr: "" });
  await expect(readPrSnapshot(run, 7, "acme/web")).rejects.toThrow("PR changed");
});

test("a failed head check preserves the GitHub error and rejects the snapshot", async () => {
  const run = vi.fn()
    .mockResolvedValueOnce({ code: 0, stdout: JSON.stringify(pr), stderr: "" })
    .mockResolvedValueOnce({ code: 0, stdout: "a diff", stderr: "" })
    .mockResolvedValueOnce({ code: 1, stdout: '{"message":"Bad credentials"}', stderr: "HTTP 401" });
  await expect(readPrSnapshot(run, 7, "acme/web")).rejects.toThrow("Bad credentials");
});
