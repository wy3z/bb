import { describe, expect, it } from "vitest";
import type { PluginThreadPanelActionRegistration } from "../app-contract.js";
import { collectPluginAppRegistrations } from "./plugin-app-collector.js";

function collect(registration: Partial<PluginThreadPanelActionRegistration>) {
  return collectPluginAppRegistrations({
    __bbPluginApp: true,
    setup(app) {
      app.slots.threadPanelAction({
        id: "tree",
        title: "Files",
        component: () => null,
        ...registration,
      });
    },
  });
}

describe("slots.threadPanelAction experimental_pinned", () => {
  it("keeps a pinned action and leaves others unpinned", () => {
    expect(
      collect({ experimental_pinned: true }).threadPanelActions[0]
        ?.experimental_pinned,
    ).toBe(true);
    expect(collect({}).threadPanelActions[0]).not.toHaveProperty(
      "experimental_pinned",
    );
    expect(
      collect({ experimental_pinned: false }).threadPanelActions[0],
    ).not.toHaveProperty("experimental_pinned");
  });

  it("rejects a value that is not a boolean", () => {
    expect(() =>
      collect({ experimental_pinned: "yes" as unknown as boolean }),
    ).toThrow(/experimental_pinned/);
  });
});
