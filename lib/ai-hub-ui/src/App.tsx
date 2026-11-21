import { useMemo, type ReactNode } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useAuth } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Redirect, Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { HubRuntimeProvider, useHubRuntime, type HubConfiguration } from "./runtime";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import NotFound from "./pages/not-found";
import Home from "./pages/home";
import { useEffect } from "react";

function stripBase(path: string, basePath: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function clerkAppearance(basePath: string, logoUrl: string, cssLayerName?: string) { return {
  cssLayerName,
  theme: shadcn,
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${logoUrl}`,
  },
  variables: {
    colorPrimary: "#4f5edb",
    colorForeground: "#252b37",
    colorMutedForeground: "#697183",
    colorDanger: "#bd4b4b",
    colorBackground: "#fffefa",
    colorInput: "#fffefa",
    colorInputForeground: "#252b37",
    colorNeutral: "#d9d9d2",
    fontFamily: "DM Sans, sans-serif",
    borderRadius: "0.9rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#fffefa] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-[0_24px_80px_rgba(43,50,67,0.12)]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#252b37] font-semibold tracking-[-0.03em]",
    headerSubtitle: "text-[#697183]",
    socialButtonsBlockButtonText: "text-[#252b37] font-medium",
    formFieldLabel: "text-[#343b49] font-medium",
    footerActionLink: "text-[#4656cc] font-semibold",
    footerActionText: "text-[#697183]",
    dividerText: "text-[#697183]",
    identityPreviewEditButton: "text-[#4656cc] font-medium",
    formFieldSuccessText: "text-[#346d55]",
    alertText: "text-[#8f3636]",
    logoBox: "mb-2",
    logoImage: "h-9 w-auto",
    socialButtonsBlockButton: "border-[#dedfd8] bg-[#fffefa] hover:bg-[#f5f4ee]",
    formButtonPrimary: "bg-[#4f5edb] hover:bg-[#414fc5] text-white font-semibold shadow-none",
    formFieldInput: "border-[#dedfd8] bg-[#fffefa] text-[#252b37] focus:border-[#4f5edb] focus:ring-[#4f5edb]",
    footerAction: "border-t border-[#e8e7e0]",
    dividerLine: "bg-[#e8e7e0]",
    alert: "border-[#e9caca] bg-[#fff8f6]",
    otpCodeFieldInput: "border-[#dedfd8] bg-[#fffefa] text-[#252b37]",
    formFieldRow: "gap-1.5",
    main: "gap-5",
  },
}; }

function HomeRedirect() {
  const { Landing, Workspace = Home, workspaceAtRoot = false } = useHubRuntime();
  return (
    <>
      <Show when="signed-in">
        {workspaceAtRoot ? <Workspace /> : <Redirect to="/workspace" />}
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function WorkspaceRoute() {
  const { Workspace = Home } = useHubRuntime();
  return (
    <>
      <Show when="signed-in">
        <Workspace />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function SignInPage() {
  const { basePath, forceRedirectUrl } = useHubRuntime();
  return (
    <main className="auth-page">
      <div className="auth-orbit auth-orbit-one" aria-hidden="true" />
      <div className="auth-orbit auth-orbit-two" aria-hidden="true" />
      <div className="auth-clerk-surface">
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
          forceRedirectUrl={forceRedirectUrl}
        />
      </div>
    </main>
  );
}

function SignUpPage() {
  const { basePath, forceRedirectUrl } = useHubRuntime();
  return (
    <main className="auth-page">
      <div className="auth-orbit auth-orbit-one" aria-hidden="true" />
      <div className="auth-orbit auth-orbit-two" aria-hidden="true" />
      <div className="auth-clerk-surface">
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
          forceRedirectUrl={forceRedirectUrl}
        />
      </div>
    </main>
  );
}

function CustomerQueryProvider({ children }: { children: ReactNode }) {
  const { dataClient } = useHubRuntime();
  const { userId, isLoaded } = useAuth();
  // A fresh cache per identity means an in-flight response from the previous
  // account can only update its old, detached cache.
  const identity = isLoaded ? userId ?? "signed-out" : "loading";
  const client = useMemo(() => dataClient.createQueryClient(), [identity, dataClient]);
  useEffect(() => () => {
    void client.cancelQueries();
    client.clear();
  }, [client]);
  return <QueryClientProvider key={identity} client={client}>{children}</QueryClientProvider>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/workspace" component={WorkspaceRoute} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const { basePath, publishableKey, proxyUrl, logoUrl, beforeRoutes, clerkCssLayerName } = useHubRuntime();
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      proxyUrl={proxyUrl}
      appearance={clerkAppearance(basePath, logoUrl, clerkCssLayerName)}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to return to your AI Hub workspace.",
          },
        },
        signUp: {
          start: {
            title: "Make room for better thinking",
            subtitle: "Create an account to open your AI Hub workspace.",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to, basePath))}
      routerReplace={(to) => setLocation(stripBase(to, basePath), { replace: true })}
    >
      <CustomerQueryProvider>
        {beforeRoutes}
        <Router />
      </CustomerQueryProvider>
    </ClerkProvider>
  );
}

function App(config: HubConfiguration) {
  return (
    <HubRuntimeProvider value={config}>
    <TooltipProvider>
      <Toaster />
      <WouterRouter base={config.basePath}>
          <ClerkProviderWithRoutes />
      </WouterRouter>
    </TooltipProvider>
    </HubRuntimeProvider>
  );
}

export default App;
