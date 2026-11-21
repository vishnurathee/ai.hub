import { createContext, useContext, type ComponentType, type ReactNode } from "react";
import type { HubDataClient } from "./lib/queryClient";

export type HubConfiguration = {
  basePath: string;
  publishableKey: string;
  proxyUrl?: string;
  clerkCssLayerName?: string;
  logoUrl: string;
  Landing: ComponentType;
  Workspace?: ComponentType;
  workspaceAtRoot?: boolean;
  dataClient: HubDataClient;
  forceRedirectUrl?: string;
  beforeRoutes?: ReactNode;
};

const HubRuntime = createContext<HubConfiguration | null>(null);
export const HubRuntimeProvider = HubRuntime.Provider;

export function useHubRuntime() {
  const config = useContext(HubRuntime);
  if (!config) throw new Error("Hub workspace must be rendered inside HubApp.");
  return config;
}

export function useHubApi() {
  return useHubRuntime().dataClient;
}
