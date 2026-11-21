import { HubApp } from "@workspace/ai-hub-ui";
import { publishableKeyFromHost } from "@clerk/react/internal";
import "./kinetic-workspace.css";
import "./premium-workspace.css";
import Landing from "@/pages/landing";
import { hubDataClient } from "@/lib/queryClient";
import logoUrl from "./ai-hub-logo.svg?url";
import "./landing-auth.css";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

if (!clerkPubKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");

export default function App() {
  return <HubApp
    basePath={basePath}
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    logoUrl={logoUrl}
    Landing={Landing}
    dataClient={hubDataClient}
  />;
}
