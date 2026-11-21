import { useState } from "react";
import { useHubRuntime } from "../runtime";
import { useClerk, useUser } from "@clerk/react";
import type { AiProvider, Conversation } from "../lib/api-types";
import { cn } from "../lib/utils";
import { isGeminiPreview } from "../lib/provider-route";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";

interface SidebarProps {
  providers: AiProvider[];
  selectedProviderId: string;
  conversations: Conversation[];
  selectedConversationId: string;
  onProviderSelect: (providerId: string) => void;
  onConversationSelect: (conversationId: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onTogglePinConversation: (conversationId: string, isPinned: boolean) => void;
  onDeleteConversation: (conversationId: string) => void;
  onCompareClick: () => void;
  onSettingsClick: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  providers,
  selectedProviderId,
  conversations,
  selectedConversationId,
  onProviderSelect,
  onConversationSelect,
  onNewConversation,
  onRenameConversation,
  onTogglePinConversation,
  onDeleteConversation,
  onCompareClick,
  onSettingsClick,
  isOpen,
  onClose,
}: SidebarProps) {
  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const { signOut } = useClerk();
  const { basePath } = useHubRuntime();
  const { user, isLoaded } = useUser();
  const accountLabel = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Your account";
  const accountInitials = (user?.firstName?.[0] || user?.primaryEmailAddress?.emailAddress?.[0] || "A")
    .toLocaleUpperCase();

  const openRenameDialog = (conversation: Conversation) => {
    setRenameTarget(conversation);
    setRenameValue(conversation.title);
  };

  const submitRename = () => {
    const title = renameValue.trim();
    if (!renameTarget || !title) return;
    onRenameConversation(renameTarget.id, title);
    setRenameTarget(null);
  };

  return (
    <>
      <aside
        aria-label="Workspace navigation"
        className={cn(
          "kw-sidebar flex flex-col transition-transform duration-300 ease-in-out fixed lg:static inset-y-0 left-0 z-50",
          isOpen ? "kw-sidebar-open translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
      <div className="kw-brand">
          <div className="kw-brand-stamp" aria-hidden="true"><span /><span /><span /></div>
          <div><strong>AI <span>Hub</span></strong><small>PRIVATE WORKSPACE</small></div>
          <button
            onClick={onClose}
            className="kw-icon-button kw-close-menu"
            data-testid="button-close-sidebar"
            aria-label="Close navigation"
          >
            ×
          </button>
      </div>

      <div className="kw-sidebar-scroll">
        <section className="kw-model-section" aria-labelledby="kw-model-heading">
          <div className="kw-section-head"><h2 id="kw-model-heading">Assistants</h2><span>{String(providers.length).padStart(2, "0")}</span></div>
          <div className="kw-provider-list">
          {providers.map((provider) => {
            const isPreview = isGeminiPreview(provider);
            const isUnavailable = provider.name === "claude";
            return (
            <button
              type="button"
              key={provider.id}
              onClick={() => {
                onProviderSelect(provider.id);
                if (window.innerWidth < 1024) onClose();
              }}
              className={cn("kw-provider", selectedProviderId === provider.id && "kw-provider-selected")}
              aria-pressed={selectedProviderId === provider.id}
              data-testid={`ai-provider-${provider.name}`}
            >
              <span className={cn("kw-provider-mark", provider.name === "chatgpt" ? "kw-tone-mint" : provider.name === "claude" ? "kw-tone-coral" : provider.name === "gemini" ? "kw-tone-sky" : provider.name === "grok" ? "kw-tone-ink" : provider.name === "perplexity" ? "kw-tone-aqua" : "kw-tone-orange")}>{provider.name === "claude" ? "Cl" : provider.name === "chatgpt" ? "C" : provider.name === "gemini" ? "G" : provider.name === "grok" ? "x" : provider.name === "perplexity" ? "P" : "g"}</span>
              <span className="kw-provider-copy"><b>{provider.displayName}</b><small>{isUnavailable ? "Unavailable · billing pending" : isPreview ? "Gemini-powered preview" : provider.description || "Native provider"}</small></span>
              {isPreview && <span className="kw-preview-tag">PREVIEW</span>}
              {isUnavailable && <span className="kw-unavailable-tag">UNAVAILABLE</span>}
              {selectedProviderId === provider.id && <span className="kw-provider-current" aria-label="Selected" />}
            </button>
          );})}
          </div>
          <p className="kw-provider-footnote"><span className="kw-key-glyph" aria-hidden="true">i</span> A configured secret means a key is present, not that a provider is online.</p>
        </section>

        <section className="kw-history-section" aria-labelledby="kw-history-heading" data-testid="recent-chats-section">
          <div className="kw-section-head kw-history-title">
            <h2 id="kw-history-heading">Recent conversations</h2>
            <button className="kw-new-mini" onClick={onNewConversation} aria-label="Start a new chat" data-testid="button-new-conversation">+</button>
          </div>
          <div className="kw-thread-list">
            {conversations.length === 0 ? (
              <p className="kw-no-results">
                No conversations with this assistant yet. Start a new chat.
              </p>
            ) : (
              conversations.slice(0, 12).map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => {
                    onConversationSelect(conversation.id);
                    if (window.innerWidth < 1024) onClose();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onConversationSelect(conversation.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={cn("kw-thread group", selectedConversationId === conversation.id && "kw-thread-active")}
                  data-testid={`recent-chat-${conversation.id}`}
                >
                  <span className="kw-thread-mark" aria-hidden="true">{conversation.isPinned ? "↗" : "⌁"}</span>
                  <span className="kw-thread-text">
                      <small>{conversation.updatedAt ? new Date(conversation.updatedAt).toLocaleDateString() : "RECENT THREAD"}</small>
                      <b>{conversation.title}</b>
                  </span>
                  {selectedConversationId === conversation.id && <span className="kw-thread-dot" />}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        className="kw-thread-menu mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg opacity-0 transition-all focus:opacity-100 group-hover:opacity-100"
                        aria-label={`More options for ${conversation.title}`}
                        data-testid={`button-chat-menu-${conversation.id}`}
                      >
                        <i className="fas fa-ellipsis-h text-xs"></i>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onSelect={() => openRenameDialog(conversation)}>
                        <i className="fas fa-pen w-4 text-slate-500"></i>
                        Rename chat
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onTogglePinConversation(conversation.id, !conversation.isPinned)}>
                        <i className={cn("w-4 text-slate-500", conversation.isPinned ? "fas fa-thumbtack-slash" : "fas fa-thumbtack")}></i>
                        {conversation.isPinned ? "Unpin chat" : "Pin chat"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-700"
                        onSelect={() => setDeleteTarget(conversation)}
                      >
                        <i className="fas fa-trash w-4"></i>
                        Delete chat
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="kw-sidebar-bottom">
        <div className="kw-desk-note"><span className="kw-note-spark" aria-hidden="true">i</span><span><b>One question. More perspective.</b><small>Compare the thinking, not just the answer.</small></span></div>
        <button onClick={onCompareClick} className="kw-settings-link" data-testid="button-compare">
          <span aria-hidden="true">Ⅱ</span> Compare perspectives <span className="kw-arrow">↗</span>
        </button>
        <button
          onClick={onSettingsClick}
          className="kw-settings-link"
          data-testid="button-settings"
        >
          <span aria-hidden="true">S</span> Workspace &amp; keys <span className="kw-arrow">↗</span>
        </button>
        <div className="kw-account-control" aria-label="Signed-in account">
          <span className="kw-account-avatar" aria-hidden="true">
            {isLoaded ? accountInitials : "A"}
          </span>
          <span className="kw-account-copy">
            <b>{isLoaded ? accountLabel : "Loading account"}</b>
            <small>AI Hub account</small>
          </span>
          <button
            type="button"
            className="kw-account-signout"
            onClick={() => void signOut({ redirectUrl: basePath || "/" })}
            aria-label="Sign out of AI Hub"
            data-testid="button-sign-out"
          >
            Sign out
          </button>
        </div>
      </div>
      </aside>

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
          <DialogContent className="kw-native-dialog rounded-2xl border-slate-200 p-6">
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitRename();
            }}
            maxLength={120}
            className="h-11 rounded-xl"
            data-testid="input-rename-chat"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRenameTarget(null)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitRename}
              disabled={!renameValue.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="button-save-rename"
            >
              Save name
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
          <DialogContent className="kw-native-dialog rounded-2xl border-slate-200 p-6">
          <DialogHeader>
            <DialogTitle>Delete this chat?</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-6 text-slate-500">
            “{deleteTarget?.title}” and all of its messages will be permanently deleted.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Keep chat
            </button>
            <button
              type="button"
              onClick={() => {
                if (deleteTarget) onDeleteConversation(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              data-testid="button-confirm-delete-chat"
            >
              Delete chat
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}