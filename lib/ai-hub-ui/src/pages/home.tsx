import { useEffect, useState } from "react";
import Sidebar from "../components/sidebar";
import ChatInterface from "../components/chat-interface";
import ComparisonView from "../components/comparison-view";
import SettingsModal from "../components/settings-modal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHubApi } from "../runtime";
import { trackEvent } from "../lib/analytics";
import type { AiProvider, Conversation } from "../lib/api-types";

export default function Home() {
  const { apiRequest } = useHubApi();
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: providers = [], isLoading: providersLoading, isError: providersError, refetch: refetchProviders } = useQuery<AiProvider[]>({
    queryKey: ["/api/providers"],
  });

  useEffect(() => {
    if (providers.length > 0 && !selectedProviderId) {
      setSelectedProviderId(providers[0].id);
    }
  }, [providers, selectedProviderId]);

  const selectedProvider = providers.find(p => p.id === selectedProviderId);
  const conversationsQueryKey = selectedProviderId
    ? `/api/conversations?providerId=${encodeURIComponent(selectedProviderId)}`
    : "/api/conversations?providerId=none";
  const { data: recentConversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: [conversationsQueryKey],
    enabled: Boolean(selectedProviderId),
  });

  const createConversationMutation = useMutation({
    mutationFn: async (data: { providerId: string; title: string; source: string }) => {
      const res = await apiRequest("POST", "/api/conversations", {
        providerId: data.providerId,
        title: data.title,
      });
      return { conversation: await res.json() as Conversation, source: data.source };
    },
    onSuccess: ({ conversation, source }) => {
      const provider = providers.find(item => item.id === conversation.providerId);
      trackEvent("chat_created", {
        provider: provider?.name || "unknown",
        source,
      });
      setActiveConversationId(conversation.id);
      queryClient.setQueryData<Conversation[]>(
        [`/api/conversations?providerId=${encodeURIComponent(conversation.providerId || "")}`],
        (existing = []) => [conversation, ...existing.filter(item => item.id !== conversation.id)],
      );
    },
  });

  const updateConversationMutation = useMutation({
    mutationFn: async (data: { id: string; title?: string; isPinned?: boolean; action: "rename" | "pin" | "unpin" }) => {
      const res = await apiRequest("PATCH", `/api/conversations/${data.id}`, {
        title: data.title,
        isPinned: data.isPinned,
      });
      return { conversation: await res.json() as Conversation, action: data.action };
    },
    onSuccess: ({ conversation: updatedConversation, action }) => {
      const provider = providers.find(item => item.id === updatedConversation.providerId);
      if (action === "rename") {
        trackEvent("chat_renamed", { provider: provider?.name || "unknown" });
      } else {
        trackEvent(action === "pin" ? "chat_pinned" : "chat_unpinned", {
          provider: provider?.name || "unknown",
        });
      }
      const queryKey = `/api/conversations?providerId=${encodeURIComponent(updatedConversation.providerId || "")}`;
      queryClient.setQueryData<Conversation[]>([queryKey], (existing = []) =>
        existing
          .map(conversation => conversation.id === updatedConversation.id ? updatedConversation : conversation)
          .sort((a, b) => {
            if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
            return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
          }),
      );
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (data: { id: string; providerId: string }) => {
      await apiRequest("DELETE", `/api/conversations/${data.id}`);
      return data;
    },
    onSuccess: ({ id, providerId }) => {
      const provider = providers.find(item => item.id === providerId);
      trackEvent("chat_deleted", { provider: provider?.name || "unknown" });
      const queryKey = `/api/conversations?providerId=${encodeURIComponent(providerId)}`;
      const existing = queryClient.getQueryData<Conversation[]>([queryKey]) || [];
      const remaining = existing.filter(conversation => conversation.id !== id);
      queryClient.setQueryData<Conversation[]>([queryKey], remaining);

      if (activeConversationId === id) {
        setActiveConversationId(remaining[0]?.id || "");
      }
    },
  });

  useEffect(() => {
    setActiveConversationId("");
  }, [selectedProviderId]);

  useEffect(() => {
    if (
      !selectedProviderId ||
      conversationsLoading ||
      createConversationMutation.isPending ||
      recentConversations.some(conversation => conversation.id === activeConversationId)
    ) {
      return;
    }

    if (recentConversations.length > 0) {
      setActiveConversationId(recentConversations[0].id);
      return;
    }

    if (selectedProvider) {
      createConversationMutation.mutate({
        providerId: selectedProvider.id,
        title: `Chat with ${selectedProvider.displayName}`,
        source: "automatic",
      });
    }
  }, [
    activeConversationId,
    conversationsLoading,
    createConversationMutation,
    recentConversations,
    selectedProvider,
    selectedProviderId,
  ]);

  const handleProviderSelect = (providerId: string) => {
    const provider = providers.find(item => item.id === providerId);
    if (provider && providerId !== selectedProviderId) {
      trackEvent("model_selected", { provider: provider.name });
    }
    setSelectedProviderId(providerId);
    setActiveConversationId("");
  };

  const handleNewConversation = () => {
    if (!selectedProvider || createConversationMutation.isPending) return;
    createConversationMutation.mutate({
      providerId: selectedProvider.id,
      title: `Chat with ${selectedProvider.displayName}`,
      source: "new_chat",
    });
  };

  const handleConversationSelect = (conversationId: string) => {
    const conversation = recentConversations.find(item => item.id === conversationId);
    if (conversation && conversationId !== activeConversationId) {
      const provider = providers.find(item => item.id === conversation.providerId);
      trackEvent("chat_opened", { provider: provider?.name || "unknown" });
    }
    setActiveConversationId(conversationId);
  };
  const workspaceContent = providersLoading ? (
    <section className="kw-main-empty" aria-label="Loading assistants">
      <div className="kw-loading-state"><div className="kw-skeleton-line kw-skeleton-short" /><div className="kw-skeleton-line" /><div className="kw-skeleton-line kw-skeleton-medium" /></div>
    </section>
  ) : providersError ? (
    <section className="kw-main-empty">
      <div className="kw-error-state" role="alert"><b>Your workspace could not load.</b><span>Check your connection, then retry.</span><button onClick={() => void refetchProviders()}>Try again</button></div>
    </section>
  ) : isComparisonMode ? (
    <ComparisonView
      providers={providers}
      onExitCompare={() => setIsComparisonMode(false)}
      onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
    />
  ) : (
    <ChatInterface
      provider={selectedProvider}
      conversationId={activeConversationId}
      onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      onCompareClick={() => setIsComparisonMode(true)}
    />
  );

  return (
    <>
      <div className="app-shell kinetic-workspace premium-workspace flex min-h-[100dvh] h-[100dvh] overflow-hidden">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
            <div 
            className="kw-scrim fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
            data-testid="sidebar-overlay"
          />
        )}

        <Sidebar
          providers={providers}
          selectedProviderId={selectedProviderId}
          conversations={recentConversations}
          selectedConversationId={activeConversationId}
          onProviderSelect={handleProviderSelect}
          onConversationSelect={handleConversationSelect}
          onNewConversation={handleNewConversation}
          onRenameConversation={(id, title) => updateConversationMutation.mutate({ id, title, action: "rename" })}
          onTogglePinConversation={(id, isPinned) =>
            updateConversationMutation.mutate({ id, isPinned, action: isPinned ? "pin" : "unpin" })
          }
          onDeleteConversation={(id) => {
            if (selectedProviderId) {
              deleteConversationMutation.mutate({ id, providerId: selectedProviderId });
            }
          }}
          onCompareClick={() => setIsComparisonMode(true)}
          onSettingsClick={() => setShowSettings(true)}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="kw-main flex-1 flex flex-col min-w-0">
          {workspaceContent}
        </div>
      </div>

      <SettingsModal
        providers={providers}
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
}
