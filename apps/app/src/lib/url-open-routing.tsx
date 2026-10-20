import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { getBbDesktopInfo, isDesktopBrowserAvailable } from "@/lib/bb-desktop";
import { shellOpenExternal } from "@/lib/native-shell";
import {
  openUrlByPreference,
  useOpenLinksInAppBrowserPreference,
} from "@/lib/in-app-browser-link-preference";
import {
  AppNavigationHostProvider,
  type AppUrlOpenIntent,
} from "@/lib/app-navigation-host";
import type { PanelTabPlacement } from "@/components/secondary-panel/threadMainPaneTabs";

type OpenInAppBrowserUrl = (
  url: string,
  options?: { placement?: PanelTabPlacement },
) => void;

interface UrlOpenRoutingProviderProps {
  children: ReactNode;
  openInAppBrowser: OpenInAppBrowserUrl | null;
}

type UrlAnchorClickHandler = (
  event: ReactMouseEvent<HTMLAnchorElement>,
) => void;

const InAppBrowserUrlOpenContext = createContext<OpenInAppBrowserUrl | null>(
  null,
);

export function openUrlInExternalBrowser(url: string): void {
  const desktopInfo = getBbDesktopInfo();
  if (desktopInfo !== null) {
    desktopInfo.openExternalUrl(url);
    return;
  }
  if (shellOpenExternal(url)) return;
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function UrlOpenRoutingProvider({
  children,
  openInAppBrowser,
}: UrlOpenRoutingProviderProps) {
  return (
    <InAppBrowserUrlOpenContext.Provider value={openInAppBrowser}>
      <AppNavigationUrlHost>{children}</AppNavigationUrlHost>
    </InAppBrowserUrlOpenContext.Provider>
  );
}

export function AppNavigationUrlHost({ children }: { children: ReactNode }) {
  const openUrl = useOpenUrlByPreference();
  const capabilities = useMemo(
    () => ({
      openUrl: ({ url, placement }: AppUrlOpenIntent) =>
        openUrl(url, placement),
    }),
    [openUrl],
  );
  return (
    <AppNavigationHostProvider capabilities={capabilities}>
      {children}
    </AppNavigationHostProvider>
  );
}

function useOpenUrlByPreference(): (
  url: string,
  placement?: PanelTabPlacement,
) => boolean {
  const openInAppBrowser = useContext(InAppBrowserUrlOpenContext);
  const [openLinksInAppBrowser] = useOpenLinksInAppBrowserPreference();
  const desktopBrowserAvailable =
    openInAppBrowser !== null && isDesktopBrowserAvailable();

  return useCallback(
    (url: string, placement?: PanelTabPlacement) =>
      openUrlByPreference({
        desktopBrowserAvailable,
        openExternalBrowser: openUrlInExternalBrowser,
        openInAppBrowser:
          openInAppBrowser === null
            ? openUrlInExternalBrowser
            : (inAppUrl) =>
                openInAppBrowser(
                  inAppUrl,
                  placement === undefined ? undefined : { placement },
                ),
        openLinksInAppBrowser,
        url,
      }),
    [desktopBrowserAvailable, openInAppBrowser, openLinksInAppBrowser],
  );
}

export function useUrlAnchorClickHandler(
  url: string | undefined,
): UrlAnchorClickHandler {
  const openUrl = useOpenUrlByPreference();

  return useCallback(
    (event) => {
      if (event.defaultPrevented || event.button !== 0 || url === undefined) {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (openUrl(url)) {
        event.preventDefault();
      }
    },
    [openUrl, url],
  );
}
