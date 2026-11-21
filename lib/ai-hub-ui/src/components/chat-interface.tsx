import { useRef, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trackEvent } from "../lib/analytics";
import { useHubApi } from "../runtime";
import MessageInput from "../components/message-input";
import type { AiProvider, Message } from "../lib/api-types";
import { cn } from "../lib/utils";
import { isGeminiPreview, providerRouteLabel } from "../lib/provider-route";

interface ChatInterfaceProps {
  provider?: AiProvider;
  conversationId?: string;
  onToggleSidebar: () => void;
  onCompareClick: () => void;
}

class ChatSendError extends Error {
  constructor(message: string, readonly userMessageId?: string) {
    super(message);
  }
}

export default function ChatInterface({ provider, conversationId, onToggleSidebar, onCompareClick }: ChatInterfaceProps) {
  const { apiRequest } = useHubApi();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef<{ conversationId?: string; count: number; initialized: boolean }>({ count: 0, initialized: false });
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const { data: messages = [], isLoading, isError, refetch } = useQuery<Message[]>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    enabled: !!conversationId,
  });
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: string; content?: string; retryMessageId?: string }) => {
      let res: Response;
      try {
        res = await apiRequest(
          "POST",
          `/api/conversations/${data.conversationId}/messages`,
          data.retryMessageId ? { retryMessageId: data.retryMessageId } : { content: data.content },
        );
      } catch (error) {
        const errorText = error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "";
        let body: { message?: string; userMessageId?: string } = {};
        try {
          body = JSON.parse(errorText) as typeof body;
        } catch {
          body = {};
        }
        throw new ChatSendError(
          body.message || "Your message could not be sent. Please try again.",
          body.userMessageId,
        );
      }
      return res.json();
    },
    onSuccess: () => {
      trackEvent("chat_message_sent", { provider: provider?.name || "unknown" });
    },
    onSettled: (_data, _error, variables) => {
      if (!variables) return;
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", variables.conversationId, "messages"] });
      if (provider) queryClient.invalidateQueries({
        queryKey: [`/api/conversations?providerId=${encodeURIComponent(provider.id)}`],
      });
    },
  });
  useEffect(() => {
    const previous = lastSeenRef.current;
    if (previous.conversationId !== conversationId) {
      lastSeenRef.current = { conversationId, count: messages.length, initialized: messages.length > 0 };
      return;
    }
    if (!previous.initialized && messages.length > 0) {
      lastSeenRef.current = { conversationId, count: messages.length, initialized: true };
      return;
    }
    if (messages.length > previous.count) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    lastSeenRef.current = { conversationId, count: messages.length, initialized: previous.initialized || messages.length > 0 };
  }, [conversationId, messages]);

  const handleShare = async () => {
    try {
      const text = messages.map((message) => `${message.role === "user" ? "You" : provider?.displayName}: ${message.content}`).join("\n\n");
      if (!text) throw new Error("Nothing to copy yet");
      await navigator.clipboard.writeText(text);
      setNotice("Conversation copied to clipboard");
    } catch {
      setNotice("Clipboard access is unavailable");
    }
    window.setTimeout(() => setNotice(""), 2400);
  };
  const handleSendMessage = async (content: string) => {
    if (!conversationId || !content.trim() || provider?.name === "claude" || sendMessageMutation.isPending) return false;
    try {
      await sendMessageMutation.mutateAsync({ conversationId, content: content.trim() });
      return true;
    } catch (error) {
      // Provider failures may still acknowledge a saved message for safe retry.
      if (error instanceof ChatSendError && error.userMessageId) return true;
      throw error;
    }
  };
  const sendError = sendMessageMutation.variables?.conversationId === conversationId && sendMessageMutation.isError
    ? sendMessageMutation.error : null;
  const lastMessage = messages.at(-1);
  const unansweredMessageId = lastMessage?.role === "user" ? lastMessage.id : undefined;
  const retryMessageId = sendError instanceof ChatSendError
    ? sendError.userMessageId || unansweredMessageId
    : unansweredMessageId;
  const isUnavailable = provider?.name === "claude";
  const isPreview = provider ? isGeminiPreview(provider) : false;

  if (!provider) return (
    <section className="kw-main-empty">
      <button onClick={onToggleSidebar} className="kw-menu-button" aria-label="Open models and conversations"><span /><span /></button>
      <div className="kw-empty-state"><span className="kw-empty-sticker"><i /><b /></span><span className="kw-eyebrow">YOUR AI WORKSPACE</span><h2>Choose a mind to begin</h2><p>Move between assistants and find the perspective that helps your thinking move forward.</p></div>
    </section>
  );

  return (
    <>
      <header className="kw-topbar">
        <div className="kw-top-left">
          <button onClick={onToggleSidebar} className="kw-menu-button" aria-label="Open models and conversations" data-testid="button-toggle-sidebar"><span /><span /></button>
          <div className="kw-breadcrumb"><span>Workspace</span><i>/</i><b>{provider.displayName}</b></div>
        </div>
        <div className="kw-top-actions">
          <span className="kw-private-label"><i /> PRIVATE SPACE</span>
          <button className="kw-top-action" onClick={handleShare} aria-label="Copy conversation">↗</button>
        </div>
      </header>

      <div className="kw-reading-area">
        <div className="kw-content">
          <section className="kw-welcome-card">
            <div className="kw-welcome-text">
              <span className="kw-eyebrow"><span className="kw-eyebrow-line" /> A STUDIO FOR GOOD QUESTIONS</span>
              <h1>Think out loud.<br /><em>Find your way.</em></h1>
              <p>One curious mind or a few at once. Pull up a chair and see where the thought goes.</p>
            </div>
            <div className="kw-orbit-art" aria-label="Abstract orbital illustration of ideas" role="img">
              <span className="kw-orbit orbit-outer" /><span className="kw-orbit orbit-mid" /><span className="kw-orbit orbit-inner" />
              <span className="kw-art-sun" /><span className="kw-art-seed seed-one" /><span className="kw-art-seed seed-two" /><span className="kw-art-seed seed-three" /><span className="kw-art-label">IDEAS<br />IN MOTION</span>
            </div>
            <div className="kw-welcome-index"><span>01</span><i /> A LITTLE SPACE TO THINK</div>
          </section>

          <div className="kw-chat-toolbar">
            <div className="kw-current-model">
              <span className={cn("kw-provider-mark kw-mark-small", provider.name === "chatgpt" ? "kw-tone-mint" : provider.name === "claude" ? "kw-tone-coral" : provider.name === "gemini" ? "kw-tone-sky" : provider.name === "grok" ? "kw-tone-ink" : provider.name === "perplexity" ? "kw-tone-aqua" : "kw-tone-orange")}>{provider.name === "claude" ? "Cl" : provider.name === "chatgpt" ? "C" : provider.name === "gemini" ? "G" : provider.name === "grok" ? "x" : provider.name === "perplexity" ? "P" : "g"}</span>
              <span><b data-testid="text-provider-name">{provider.displayName}</b><small>{providerRouteLabel(provider)}</small></span>
              <span className="kw-config-label"><i /> {isUnavailable ? "Billing unavailable" : provider.apiKeySet ? "Secret configured" : "No secret configured"}</span>
            </div>
            <button className="kw-compare-button" onClick={onCompareClick} data-testid="button-compare-chat">
              <span className="kw-compare-icon" aria-hidden="true"><i /><i /></span><span>Compare</span><span className="kw-switch"><i /></span>
            </button>
          </div>

          {isPreview && <aside className="kw-preview-callout"><span className="kw-callout-mark">i</span><p><b>Preview route.</b> {provider.displayName} is represented by a Gemini-powered preview, not a native {provider.name === "grok" ? "xAI" : "Perplexity"} connection.</p></aside>}
          {isUnavailable && <aside className="kw-preview-callout" role="status"><span className="kw-callout-mark">i</span><p><b>Claude is unavailable.</b> Integration and billing are pending. Choose another assistant to continue.</p></aside>}

          <section className="kw-conversation" aria-label="Conversation">
            <div className="kw-date-marker"><span /> CONVERSATION <span /></div>
            {isLoading ? (
              <div className="kw-loading-state" aria-label="Loading conversation">
                <div className="kw-skeleton-line kw-skeleton-short" /><div className="kw-skeleton-line" /><div className="kw-skeleton-line kw-skeleton-medium" />
              </div>
            ) : isError ? (
              <div className="kw-error-state" role="alert"><b>This conversation couldn’t be loaded.</b><span>Check your connection, then try again.</span><button onClick={() => void refetch()}>Try again</button></div>
            ) : messages.length === 0 ? (
              <div className="kw-empty-state">
                <span className="kw-empty-sticker" aria-hidden="true"><i /><b /></span><span className="kw-eyebrow">A FRESH PAGE</span>
                <h2>What’s on your mind?</h2><p>Begin with a question, a half-formed idea, or something you want to see from another angle.</p>
                <div className="kw-prompt-suggestions">
                  {["Help me find the real question", "Turn this thought into a plan", "Give me a fresh perspective"].map((suggestion) => <button key={suggestion} onClick={() => window.dispatchEvent(new CustomEvent("ai-hub-fill-composer", { detail: suggestion }))}>{suggestion}<span aria-hidden="true">↗</span></button>)}
                </div>
              </div>
            ) : messages.map((message) => (
              <article key={message.id} className={cn("kw-message", `kw-message-${message.role}`)}>
                <span className={cn("kw-message-avatar", message.role === "user" && "kw-user-avatar")}>
                  {message.role === "user" ? "Y" : (provider.name === "claude" ? "Cl" : provider.name === "chatgpt" ? "C" : provider.name === "gemini" ? "G" : provider.name === "grok" ? "x" : provider.name === "perplexity" ? "P" : "g")}
                </span>
                <div className="kw-message-content">
                  <div className="kw-byline"><b>{message.role === "user" ? "You" : provider.displayName}</b><time>{message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Just now"}</time>{message.role === "assistant" && <span>{isPreview ? "Preview" : "Response"}</span>}</div>
                  <p>{message.content}</p>
                  {message.role === "assistant" && message.responseTime && <div className="kw-answer-footer"><span>Keep what helps. Leave what doesn’t.</span><span>{message.responseTime}</span></div>}
                </div>
              </article>
            ))}
            {sendMessageMutation.isPending && <div className="kw-message kw-message-assistant" role="status"><span className="kw-message-avatar">{provider.name === "claude" ? "Cl" : provider.name === "chatgpt" ? "C" : provider.name === "gemini" ? "G" : provider.name === "grok" ? "x" : provider.name === "perplexity" ? "P" : "g"}</span><div className="kw-message-content"><div className="kw-byline"><b>{provider.displayName}</b><span>Thinking</span></div><div className="kw-thinking-skeleton"><i /><i /><i /></div></div></div>}
            {sendError && <div className="kw-inline-error" role="alert">
              <b>Couldn’t get a reply.</b> {sendError.message}
              {retryMessageId && <button disabled={sendMessageMutation.isPending} onClick={() => conversationId && sendMessageMutation.mutate({ conversationId, retryMessageId })}>Retry reply</button>}
              <button onClick={() => sendMessageMutation.reset()}>Dismiss</button>
            </div>}
            {!sendError && !sendMessageMutation.isPending && unansweredMessageId && <div className="kw-inline-error" role="status">
              No reply yet. <button onClick={() => conversationId && sendMessageMutation.mutate({ conversationId, retryMessageId: unansweredMessageId })}>Retry reply</button>
            </div>}
            <div ref={messagesEndRef} />
          </section>
        </div>
      </div>
      <MessageInput
        onSend={handleSendMessage}
        isDisabled={sendMessageMutation.isPending || !provider.apiKeySet || !conversationId || isUnavailable}
        placeholder={isUnavailable ? "Claude is unavailable while billing is pending" : provider.apiKeySet ? `Ask ${provider.displayName} anything…` : `Configure a secret for ${provider.displayName} in workspace settings`}
      />
      {notice && <div className="kw-toast" role="status">{notice}</div>}
    </>
  );
}