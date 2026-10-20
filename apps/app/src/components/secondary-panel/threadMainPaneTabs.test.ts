import { describe, expect, it } from "vitest";
import {
  adoptTabsIntoMainPane,
  EMPTY_THREAD_MAIN_PANE_TABS,
  getMainPaneAgentTabId,
  getMainPaneAgentThreadId,
  MAIN_PANE_NEW_AGENT_TAB_ID,
  moveTabToMainPane,
  moveTabToRightPanel,
  reconcileMainPaneTabs,
  reorderMainPaneTab,
  replaceMainPaneTab,
  selectMainPaneAgentTab,
  selectMainPaneTab,
  type ThreadMainPaneTabsState,
} from "./threadMainPaneTabs";

const TWO_TABS: ThreadMainPaneTabsState = {
  tabIds: ["browser-a", "file-b"],
  activeTabId: "file-b",
};

describe("thread main pane tabs", () => {
  it("adds a moved tab once and shows it", () => {
    const moved = moveTabToMainPane(EMPTY_THREAD_MAIN_PANE_TABS, "browser-a");
    expect(moved).toEqual({ tabIds: ["browser-a"], activeTabId: "browser-a" });
    expect(moveTabToMainPane(moved, "browser-a")).toBe(moved);
  });

  it("shows the previous tab when the active tab moves back to the right panel", () => {
    expect(moveTabToRightPanel(TWO_TABS, "file-b")).toEqual({
      tabIds: ["browser-a"],
      activeTabId: "browser-a",
    });
  });

  it("returns to the chat when the last tab leaves", () => {
    const one = moveTabToMainPane(EMPTY_THREAD_MAIN_PANE_TABS, "browser-a");
    expect(moveTabToRightPanel(one, "browser-a")).toBe(
      EMPTY_THREAD_MAIN_PANE_TABS,
    );
  });

  it("keeps the chat selected when a background tab leaves", () => {
    const onChat = selectMainPaneTab(TWO_TABS, null);
    expect(moveTabToRightPanel(onChat, "browser-a")).toEqual({
      tabIds: ["file-b"],
      activeTabId: null,
    });
  });

  it("puts the tab a new tab page opened in that page's slot", () => {
    const withNewTab: ThreadMainPaneTabsState = {
      tabIds: ["browser-a", "new-tab", "file-b"],
      activeTabId: "new-tab",
    };
    expect(replaceMainPaneTab(withNewTab, "new-tab", "file-c")).toEqual({
      tabIds: ["browser-a", "file-c", "file-b"],
      activeTabId: "file-c",
    });
    expect(replaceMainPaneTab(withNewTab, "new-tab", "file-b")).toEqual({
      tabIds: ["browser-a", "file-b"],
      activeTabId: "file-b",
    });
    expect(replaceMainPaneTab(TWO_TABS, "new-tab", "file-c")).toBe(TWO_TABS);
  });

  it("ignores a selection of a tab it does not hold", () => {
    expect(selectMainPaneTab(TWO_TABS, "terminal-x")).toBe(TWO_TABS);
    expect(selectMainPaneTab(TWO_TABS, null).activeTabId).toBeNull();
  });

  it("reorders within the strip", () => {
    expect(reorderMainPaneTab(TWO_TABS, "file-b", "browser-a").tabIds).toEqual([
      "file-b",
      "browser-a",
    ]);
    expect(reorderMainPaneTab(TWO_TABS, "file-b", "missing")).toBe(TWO_TABS);
  });

  it("drops tabs the thread closed and falls back to a neighbour", () => {
    expect(reconcileMainPaneTabs(TWO_TABS, ["browser-a", "info"])).toEqual({
      tabIds: ["browser-a"],
      activeTabId: "browser-a",
    });
    expect(reconcileMainPaneTabs(TWO_TABS, ["browser-a", "file-b"])).toBe(
      TWO_TABS,
    );
    expect(reconcileMainPaneTabs(TWO_TABS, ["info"])).toBe(
      EMPTY_THREAD_MAIN_PANE_TABS,
    );
  });

  it("keeps a New agent draft, which is not a panel tab", () => {
    const withDraft = moveTabToMainPane(TWO_TABS, MAIN_PANE_NEW_AGENT_TAB_ID);
    expect(reconcileMainPaneTabs(withDraft, ["browser-a", "file-b"])).toBe(
      withDraft,
    );
  });

  it("builds and reads agent tab ids", () => {
    const agentTabId = getMainPaneAgentTabId("thread-a");
    expect(agentTabId).toBe("main-pane:agent:thread-a");
    expect(getMainPaneAgentThreadId(agentTabId)).toBe("thread-a");
    expect(getMainPaneAgentThreadId(MAIN_PANE_NEW_AGENT_TAB_ID)).toBeNull();
    expect(getMainPaneAgentThreadId("browser-a")).toBeNull();
    expect(getMainPaneAgentThreadId(null)).toBeNull();
    expect(getMainPaneAgentThreadId("main-pane:agent:")).toBeNull();
  });

  it("selects an agent without adding it to the tab ids", () => {
    const onAgent = selectMainPaneAgentTab(TWO_TABS, "thread-a");
    expect(onAgent).toEqual({
      tabIds: ["browser-a", "file-b"],
      activeTabId: "main-pane:agent:thread-a",
    });
    expect(selectMainPaneAgentTab(onAgent, "thread-a")).toBe(onAgent);
    expect(selectMainPaneAgentTab(onAgent, null)).toEqual({
      tabIds: ["browser-a", "file-b"],
      activeTabId: null,
    });
  });

  it("keeps an agent tab selected while panel tabs come and go", () => {
    const onAgent = selectMainPaneAgentTab(TWO_TABS, "thread-a");
    expect(reconcileMainPaneTabs(onAgent, [])).toEqual({
      tabIds: [],
      activeTabId: "main-pane:agent:thread-a",
    });
    expect(reconcileMainPaneTabs(onAgent, ["browser-a", "file-b"])).toBe(
      onAgent,
    );
  });

  it("adopts tabs without changing what is showing", () => {
    expect(adoptTabsIntoMainPane(TWO_TABS, ["file-b", "file-c"])).toEqual({
      tabIds: ["browser-a", "file-b", "file-c"],
      activeTabId: "file-b",
    });
    expect(adoptTabsIntoMainPane(TWO_TABS, ["browser-a"])).toBe(TWO_TABS);
  });
});
