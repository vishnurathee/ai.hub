import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import type { AiProvider } from "../lib/api-types";
import { cn } from "../lib/utils";
import { isGeminiPreview } from "../lib/provider-route";

interface SettingsModalProps {
  providers: AiProvider[];
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ providers, isOpen, onClose }: SettingsModalProps) {
  const usesGeminiPreview = isGeminiPreview;

  const getProviderConnectionStatus = (provider: AiProvider) => {
    if (provider.name === "claude") return "Unavailable · billing pending";
    if (usesGeminiPreview(provider)) {
      return provider.apiKeySet ? "Preview · secret configured" : "Preview · no secret";
    }
    return provider.apiKeySet ? "Secret configured" : "No secret";
  };

  const getProviderStatusColor = (provider: AiProvider) => {
    if (provider.name === "claude") return "text-amber-700";
    if (usesGeminiPreview(provider)) {
      return "text-amber-700";
    }
    return "text-slate-600";
  };

  const getProviderStatusDot = (provider: AiProvider) => {
    if (provider.name === "claude") return "bg-amber-400";
    if (usesGeminiPreview(provider)) {
      return "bg-amber-400";
    }
    return provider.apiKeySet ? "bg-slate-500" : "bg-slate-300";
  };

  const getSecretName = (provider: AiProvider) => {
    switch (provider.name) {
      case "chatgpt":
        return "OPENAI_API_KEY";
      case "claude":
        return "ANTHROPIC_API_KEY";
      case "gemini":
        return "GEMINI_API_KEY";
      case "groq":
        return "GROQ_API_KEY";
      case "perplexity":
        return "PERPLEXITY_API_KEY";
      default:
        return "GEMINI_API_KEY";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="kw-settings-dialog max-h-[90vh] max-w-2xl overflow-y-auto rounded-3xl border border-slate-200/80 bg-slate-50 p-0 shadow-2xl shadow-slate-900/20">
        <DialogHeader>
          <div className="kw-settings-head rounded-t-3xl border-b border-slate-200/80 bg-white px-6 py-6">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <i className="fas fa-sliders-h"></i>
            </div>
            <DialogTitle className="display-font text-2xl font-semibold text-slate-900">
              Settings & connections
            </DialogTitle>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              Provider keys are managed securely in Replit Secrets, not saved in this screen.
            </p>
          </div>
        </DialogHeader>

        <div className="space-y-6 px-6 py-6">
          {/* API Keys Section */}
          <div>
            <div className="mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-700">AI connections</h3>
              <p className="mt-1 text-xs text-slate-500">
                Add or replace a workspace secret in Replit Secrets, then restart the app. “Secret configured” checks only that a key is present, not API credits or model access.
              </p>
            </div>
            <div className="space-y-4">
              {providers.map((provider) => (
                <div key={provider.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <div className={`kw-provider-mark mr-3 h-9 w-9 ${provider.name === "chatgpt" ? "kw-tone-mint" : provider.name === "claude" ? "kw-tone-coral" : provider.name === "gemini" ? "kw-tone-sky" : provider.name === "grok" ? "kw-tone-ink" : provider.name === "perplexity" ? "kw-tone-aqua" : "kw-tone-orange"}`}>
                        {provider.name === "claude" ? "Cl" : provider.name === "chatgpt" ? "C" : provider.name === "gemini" ? "G" : provider.name === "grok" ? "x" : provider.name === "perplexity" ? "P" : "g"}
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{provider.displayName}</h4>
                        <p className="text-xs text-slate-500">{provider.description}</p>
                        {provider.name === "gemini" && (
                          <p className="mt-1 text-[11px] font-medium text-emerald-600">Free tier available · usage limits apply</p>
                        )}
                        {provider.name === "groq" && (
                          <p className="mt-1 text-[11px] font-medium text-emerald-600">Free plan available · rate limits apply</p>
                        )}
                        {usesGeminiPreview(provider) && (
                          <p className="mt-1 text-[11px] font-medium text-amber-700">{provider.displayName} uses a Gemini-powered preview, not a native {provider.name === "grok" ? "xAI" : "Perplexity"} connection.</p>
                        )}
                        {provider.name === "perplexity" && !usesGeminiPreview(provider) && (
                          <p className="mt-1 text-[11px] font-medium text-slate-600">Native API · pay-as-you-go usage</p>
                        )}
                        {provider.name === "claude" && (
                          <p className="mt-1 text-[11px] font-medium text-amber-700">Unavailable while integration and billing are pending.</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-slate-50 px-2.5 py-1 text-xs">
                      <div className={cn("h-2 w-2 rounded-full", getProviderStatusDot(provider))}></div>
                      <span className={cn("font-medium", getProviderStatusColor(provider))}>
                        {getProviderConnectionStatus(provider)}
                      </span>
                    </div>
                  </div>
                  {provider.name !== "grok" && (
                    <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {provider.name === "perplexity" ? "Native API secret: " : "Workspace secret: "}
                      <code className="font-semibold text-slate-800">{getSecretName(provider)}</code>
                      {provider.name === "groq" && (
                        <span className="block mt-1">Your existing GROK_API_KEY also works for Groq for now. Rename it to GROQ_API_KEY when convenient.</span>
                      )}
                    </p>
                  )}
                  {provider.name === "chatgpt" && (
                    <p className="text-xs text-slate-500 mt-1">
                      Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">OpenAI Platform</a>
                    </p>
                  )}
                  {provider.name === "claude" && (
                    <p className="text-xs text-slate-500 mt-1">
                      Get your API key from <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Anthropic Console</a>
                    </p>
                  )}
                  {provider.name === "gemini" && (
                    <p className="text-xs text-slate-500 mt-1">
                      Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Google AI Studio</a>
                    </p>
                  )}
                  {provider.name === "groq" && (
                    <p className="text-xs text-slate-500 mt-1">
                      Get your API key from <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Groq Console</a>
                    </p>
                  )}
                  {provider.name === "perplexity" && (
                    <p className="text-xs text-slate-500 mt-1">
                      Get your API key from <a href="https://console.perplexity.ai/project/keys" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Perplexity Console</a>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="flex justify-end space-x-3 border-t border-slate-200/80 bg-white px-6 py-4">
          <Button variant="outline" className="rounded-xl border-slate-200" onClick={onClose} data-testid="button-cancel-settings">
            Cancel
          </Button>
          <Button 
            onClick={onClose}
            className="rounded-xl bg-blue-600 shadow-md shadow-blue-600/20 hover:bg-blue-700"
            data-testid="button-save-settings"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}