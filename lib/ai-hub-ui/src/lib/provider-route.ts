import type { AiProvider } from "../lib/api-types";

/** The API description reflects whether Perplexity is native or using Gemini fallback. */
export function isGeminiPreview(provider: AiProvider): boolean {
  return provider.name === "grok"
    || (provider.name === "perplexity" && provider.description.startsWith("Preview"));
}

export function providerRouteLabel(provider: AiProvider): string {
  if (provider.name === "claude") return "Integration unavailable";
  return isGeminiPreview(provider) ? "Gemini-powered preview" : "Native provider";
}