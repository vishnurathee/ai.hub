import { useState } from "react";
import { MAX_PROMPT_CHARS } from "@workspace/api-zod/input-limits";
import { useMutation } from "@tanstack/react-query";
import { useHubApi } from "../runtime";
import { trackEvent } from "../lib/analytics";
import type { AiProvider } from "../lib/api-types";
import { cn } from "../lib/utils";
import { isGeminiPreview, providerRouteLabel } from "../lib/provider-route";

interface ComparisonViewProps {
  providers: AiProvider[];
  onExitCompare: () => void;
  onToggleSidebar: () => void;
}
interface ComparisonResponse {
  providerId: string;
  providerName: string;
  providerIcon: string;
  providerColor: string;
  response?: string;
  responseTime?: string;
  error?: string;
}

export default function ComparisonView({ providers, onExitCompare, onToggleSidebar }: ComparisonViewProps) {
  const { apiRequest } = useHubApi();
  const [prompt, setPrompt] = useState("");
  const tooLong = prompt.trim().length > MAX_PROMPT_CHARS;
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [responses, setResponses] = useState<ComparisonResponse[]>([]);
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[] | null>(null);
  const [layout, setLayout] = useState<"side" | "stack">("side");
  const availableProviders = providers.filter((provider) => provider.apiKeySet && provider.name !== "claude");
  const selectedIds = (selectedProviderIds ?? availableProviders.slice(0, 2).map((provider) => provider.id))
    .filter((id) => availableProviders.some((provider) => provider.id === id));
  const selectedProviders = availableProviders.filter((provider) => selectedIds.includes(provider.id));
  const canCompare = selectedProviders.length >= 2;
  const compareAIsMutation = useMutation({
    mutationFn: async (data: { prompt: string; providerIds: string[] }) => {
      const res = await apiRequest("POST", "/api/compare", data);
      return res.json();
    },
    onSuccess: (data, variables) => {
      setResponses((previous) => [
        ...previous.filter((item) => !variables.providerIds.includes(item.providerId)),
        ...data.responses,
      ]);
      trackEvent("comparison_completed", { provider_count: data.responses.length });
    },
  });
  const updateSelection = (ids: string[]) => {
    setSelectedProviderIds(ids);
    setResponses([]);
    setSubmittedPrompt("");
    compareAIsMutation.reset();
  };
  const handleCompare = (retryFailed = false) => {
    const nextPrompt = retryFailed ? submittedPrompt : prompt.trim();
    if (!nextPrompt || nextPrompt.length > MAX_PROMPT_CHARS || !canCompare || compareAIsMutation.isPending) return;
    const providerIds = retryFailed
      ? responses.filter((item) => item.error && selectedIds.includes(item.providerId)).map((item) => item.providerId)
      : selectedProviders.map((provider) => provider.id);
    if (!providerIds.length) return;
    if (!retryFailed) {
      setResponses([]);
      setSubmittedPrompt(nextPrompt);
    }
    compareAIsMutation.mutate({ prompt: nextPrompt, providerIds });
  };
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleCompare();
    }
  };
  return (
    <>
      <header className="kw-topbar">
        <div className="kw-top-left">
          <button onClick={onToggleSidebar} className="kw-menu-button" aria-label="Open models and conversations" data-testid="button-toggle-sidebar"><span /><span /></button>
          <div className="kw-breadcrumb"><span>Workspace</span><i>/</i><b>Compare perspectives</b></div>
        </div>
        <div className="kw-top-actions"><span className="kw-private-label"><i /> PRIVATE SPACE</span><button className="kw-exit-compare premium-chat-switch" onClick={onExitCompare} data-testid="button-exit-compare">← Return to chat</button></div>
      </header>
      <main className="kw-compare-page">
        <section className="premium-compare-intro">
          <span className="kw-eyebrow"><span className="kw-eyebrow-line" /> COMPARATIVE THINKING</span>
          <h1>One question.<br /><em>Several perspectives.</em></h1>
          <p>Read each assistant’s approach side by side. Your selected models receive the same prompt.</p>
          <div className="premium-route-note"><strong>ONE PROMPT</strong><span>Sent only to the models you select below.</span></div>
        </section>
        <div className="premium-toolbar">
          <span>{availableProviders.length.toString().padStart(2, "0")} CONFIGURED ROUTES</span>
          <span>Configured secret is not a provider health check.</span>
        </div>
        {availableProviders.length > 0 && (
          <section className="premium-controls" aria-label="Comparison options">
            <div className="premium-controls-head">
              <div>
                <h2>Select assistants</h2>
                <p>Select at least two. Only selected models receive your question.</p>
              </div>
              {availableProviders.length > 2 && (
                <button type="button" className="premium-select-all" onClick={() => updateSelection(availableProviders.map((provider) => provider.id))} disabled={compareAIsMutation.isPending || selectedProviders.length === availableProviders.length}>
                  Select all
                </button>
              )}
            </div>
            <div className="premium-models">
              {availableProviders.map((provider) => (
                <label key={provider.id} className={cn("premium-model", selectedIds.includes(provider.id) && "selected")}>
                  <input
                    type="checkbox"
                    value={provider.id}
                    checked={selectedIds.includes(provider.id)}
                    disabled={compareAIsMutation.isPending}
                    onChange={(event) => updateSelection(event.target.checked
                      ? [...selectedIds, provider.id]
                      : selectedIds.filter((id) => id !== provider.id))}
                    data-testid={`select-compare-${provider.name}`}
                  />
                  <span>{provider.displayName}</span>
                  {isGeminiPreview(provider) && <small>Gemini preview</small>}
                </label>
              ))}
            </div>
            <div className="premium-controls-foot">
              <span role="status">{canCompare ? `${selectedProviders.length} models selected` : "Select at least two models to compare"}</span>
              <div className="premium-layout" role="group" aria-label="Response layout">
                <button type="button" aria-pressed={layout === "side"} onClick={() => setLayout("side")}>Side by side</button>
                <button type="button" aria-pressed={layout === "stack"} onClick={() => setLayout("stack")}>Stacked</button>
              </div>
            </div>
          </section>
        )}
        {availableProviders.length === 0 ? (
          <div className="premium-empty">
            <h2>No comparison routes yet</h2>
            <p>Add a provider secret in Workspace &amp; keys. Claude is not included while integration and billing are pending.</p>
          </div>
        ) : selectedProviders.length > 0 ? (
          <section className={cn("premium-results", layout === "stack" && "stacked")} aria-label="Provider responses">
            {selectedProviders.map((provider) => {
              const response = responses.find((item) => item.providerId === provider.id);
              return (
                <article className="premium-response" key={provider.id} data-testid={`comparison-card-${provider.name}`}>
                  <header className="premium-response-head">
                    <div className="premium-provider-name">
                      <span className="premium-provider-token">{provider.name === "chatgpt" ? "C" : provider.name === "gemini" ? "G" : provider.name === "grok" ? "x" : provider.name === "perplexity" ? "P" : "g"}</span>
                      <span>{provider.displayName}<small className="premium-route-label">{providerRouteLabel(provider)}</small></span>
                    </div>
                    <span className="premium-result-label">{compareAIsMutation.isPending && compareAIsMutation.variables?.providerIds.includes(provider.id) ? "RESPONDING" : response?.error ? "ERROR" : response ? "RESPONSE" : "READY"}</span>
                  </header>
                  <div className="premium-response-body">
                     {compareAIsMutation.isPending && compareAIsMutation.variables?.providerIds.includes(provider.id) ? (
                      <div className="kw-loading-state"><div className="kw-skeleton-line" /><div className="kw-skeleton-line" /><div className="kw-skeleton-line kw-skeleton-medium" /></div>
                     ) : response?.error ? (
                       <div className="kw-inline-error" role="alert">{response.error}</div>
                    ) : response ? (
                      <><p>{response.response}</p><div className="premium-answer-meta"><span>{isGeminiPreview(provider) ? "Gemini-powered preview response" : "Provider response"}</span><span>{response.responseTime}</span></div></>
                    ) : (
                      <div className="premium-waiting"><strong>Ready for your question</strong><span>Responses will appear here.</span></div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        ) : <div className="premium-empty"><h2>Choose your models</h2><p>Select two or more above to see their answers here.</p></div>}
        {responses.some((item) => item.error && selectedIds.includes(item.providerId)) && <button className="kw-compare-button" onClick={() => handleCompare(true)} disabled={compareAIsMutation.isPending}>Retry failed routes</button>}
        {compareAIsMutation.isError && <div className="kw-error-state" role="alert"><b>Comparison couldn’t be completed.</b><span>{compareAIsMutation.error instanceof Error ? compareAIsMutation.error.message : "Check your provider configuration and try again."}</span><button onClick={() => compareAIsMutation.reset()}>Dismiss</button></div>}
      </main>
      <footer className="premium-compose-wrap">
        <form className="premium-compose" onSubmit={(event) => { event.preventDefault(); handleCompare(); }}>
          <label htmlFor="kw-compare-prompt">QUESTION FOR SELECTED ASSISTANTS</label>
            <textarea id="kw-compare-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={handleKeyDown} placeholder="What would you like to see from another angle?" disabled={compareAIsMutation.isPending || availableProviders.length === 0} rows={1} data-testid="input-compare-prompt" />
            <div className="premium-compose-tools"><span role={tooLong ? "alert" : undefined}>{tooLong ? `Keep your prompt within ${MAX_PROMPT_CHARS.toLocaleString()} characters. Your draft is preserved.` : "Ctrl / Cmd + Enter to send"}</span><button type="submit" disabled={!prompt.trim() || tooLong || compareAIsMutation.isPending || !canCompare} data-testid="button-ask-all"><span>{compareAIsMutation.isPending ? "Comparing" : canCompare ? `Compare ${selectedProviders.length} models` : "Choose 2+ models"}</span><b aria-hidden="true"> ↑</b></button></div>
          <p className="premium-compose-foot"><span>Preview routes use Gemini; native routes contact their named provider. A key is not a health check.</span><span>{selectedProviders.length} route{selectedProviders.length === 1 ? "" : "s"} selected</span></p>
        </form>
      </footer>
    </>
  );
}