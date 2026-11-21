import type { IconType } from "react-icons";
import {
  SiAnthropic,
  SiGooglegemini,
  SiPerplexity,
} from "react-icons/si";
import { RiOpenaiFill } from "react-icons/ri";
import type { AiProvider } from "@/lib/api-types";
import { cn } from "@/lib/utils";

interface ProviderLogoProps {
  provider: Pick<AiProvider, "name" | "icon">;
  className?: string;
}

const providerLogos: Record<string, IconType> = {
  chatgpt: RiOpenaiFill,
  claude: SiAnthropic,
  gemini: SiGooglegemini,
  perplexity: SiPerplexity,
};

const providerLogoBackgrounds: Record<string, string> = {
  chatgpt: "bg-[#10a37f]",
  claude: "bg-[#d97757]",
  gemini: "bg-gradient-to-br from-blue-500 to-indigo-600",
  grok: "bg-black",
  groq: "bg-[#f55036]",
  perplexity: "bg-[#20b8cd]",
};

export function getProviderLogoBackground(providerName: string) {
  return providerLogoBackgrounds[providerName] || "bg-slate-700";
}

export default function ProviderLogo({ provider, className }: ProviderLogoProps) {
  if (provider.name === "grok") {
    return (
      <span
        className={cn("font-black tracking-[-0.08em]", className)}
        aria-label="xAI"
        title="xAI"
      >
        xAI
      </span>
    );
  }

  if (provider.name === "groq") {
    return (
      <span className={cn("font-black tracking-[-0.07em]", className)} aria-label="Groq" title="Groq">
        groq
      </span>
    );
  }

  const Logo = providerLogos[provider.name];
  if (Logo) {
    return <Logo className={className} aria-hidden="true" />;
  }

  return <i className={cn(provider.icon, className)} aria-hidden="true"></i>;
}