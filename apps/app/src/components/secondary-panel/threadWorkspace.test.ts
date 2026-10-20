import { describe, expect, it } from "vitest";
import {
  linkThreadToWorkspace,
  resolveWorkspaceThreadIds,
  type WorkspaceThreadCandidate,
} from "./threadWorkspace";

function thread(
  id: string,
  createdAt: number,
  environment: { id: string; isWorktree: boolean } | null,
  parentThreadId: string | null = null,
): WorkspaceThreadCandidate {
  return {
    id,
    createdAt,
    environmentId: environment?.id ?? null,
    environmentIsWorktree: environment?.isWorktree ?? false,
    parentThreadId,
  };
}

const WORKTREE = { id: "env-worktree", isWorktree: true };
const OTHER_WORKTREE = { id: "env-other", isWorktree: true };
const CHECKOUT = { id: "env-checkout", isWorktree: false };

describe("thread workspaces", () => {
  it("groups top-level threads that share a worktree, oldest first", () => {
    const threads = [
      thread("b", 2, WORKTREE),
      thread("a", 1, WORKTREE),
      thread("child", 3, WORKTREE, "a"),
      thread("elsewhere", 4, OTHER_WORKTREE),
    ];
    expect(resolveWorkspaceThreadIds("b", threads, {})).toEqual(["a", "b"]);
  });

  it("keeps a delegated thread's own tab when it is open", () => {
    const threads = [
      thread("a", 1, WORKTREE),
      thread("child", 2, WORKTREE, "a"),
    ];
    expect(resolveWorkspaceThreadIds("child", threads, {})).toEqual([
      "a",
      "child",
    ]);
  });

  it("does not group a shared checkout by environment", () => {
    const threads = [thread("a", 1, CHECKOUT), thread("b", 2, CHECKOUT)];
    expect(resolveWorkspaceThreadIds("a", threads, {})).toEqual(["a"]);
  });

  it("groups threads started from a checkout thread's main pane", () => {
    const threads = [
      thread("a", 1, CHECKOUT),
      thread("b", 2, CHECKOUT),
      thread("c", 3, CHECKOUT),
    ];
    const once = linkThreadToWorkspace({}, "b", "a");
    const twice = linkThreadToWorkspace(once, "c", "b");
    expect(twice).toEqual({ b: "a", c: "a" });
    expect(resolveWorkspaceThreadIds("c", threads, twice)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(linkThreadToWorkspace(twice, "c", "a")).toBe(twice);
  });

  it("shows just the thread while the list has not loaded it", () => {
    expect(resolveWorkspaceThreadIds("missing", [], {})).toEqual(["missing"]);
  });
});
