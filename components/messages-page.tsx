"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { useLanguage } from "@/components/language-provider";
import { useDemoAuth } from "@/lib/use-demo-auth";
import {
  createOrGetConversation,
  getConversationMessages,
  getConversations,
  sendChatMessage,
  subscribeToConversations,
  subscribeToConversation,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/chat";
import { getProfileByUsername, isValidUsername } from "@/lib/profiles";

function getDisplayName(profile: ChatConversation["other_profile"]) {
  return profile.full_name || `@${profile.username}`;
}

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, t } = useLanguage();
  const { user, isReady } = useDemoAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [usernameQuery, setUsernameQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [pageError, setPageError] = useState("");
  const [conversationError, setConversationError] = useState("");
  const [loadedConversationUserId, setLoadedConversationUserId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadedMessagesFor, setLoadedMessagesFor] = useState<string | null>(null);
  const processedStart = useRef("");
  const messagesEnd = useRef<HTMLDivElement>(null);

  const conversationId = searchParams.get("conversation");
  const targetUserId = searchParams.get("userId");
  const itemId = searchParams.get("itemId");
  const returnQuery = new URLSearchParams();
  if (conversationId) returnQuery.set("conversation", conversationId);
  if (targetUserId) returnQuery.set("userId", targetUserId);
  if (itemId) returnQuery.set("itemId", itemId);
  const returnPath = `/messages${returnQuery.size ? `?${returnQuery.toString()}` : ""}`;
  const loginHref = `/login?next=${encodeURIComponent(returnPath)}`;
  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === conversationId),
    [conversationId, conversations],
  );
  const selectedConversationId = selectedConversation?.id;
  const isLoadingConversations = Boolean(user && loadedConversationUserId !== user.id);
  const isConversationUnavailable = Boolean(
    conversationId && !isLoadingConversations && !selectedConversationId,
  );
  const isLoadingMessages = Boolean(
    conversationId && selectedConversationId && loadedMessagesFor !== conversationId,
  );

  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      setConversations(await getConversations(user.id));
    } catch (loadError) {
      setPageError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить список чатов.",
      );
    } finally {
      setLoadedConversationUserId(user.id);
    }
  }, [user]);

  const openConversation = useCallback(
    async (otherUserId: string, linkedItemId?: string) => {
      if (!user) return;
      if (otherUserId === user.id) {
        setPageError(t("chat.self"));
        return;
      }
      setPageError("");
      try {
        const id = await createOrGetConversation(otherUserId, linkedItemId);
        await loadConversations();
        router.push(`/messages?conversation=${encodeURIComponent(id)}`);
      } catch (openError) {
        setPageError(
          openError instanceof Error
            ? openError.message
            : "Не удалось открыть чат.",
        );
      }
    },
    [loadConversations, router, t, user],
  );

  useEffect(() => {
    if (user) void Promise.resolve().then(loadConversations);
  }, [loadConversations, user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToConversations(
      user.id,
      () => void loadConversations(),
      setPageError,
    );
  }, [loadConversations, user]);

  useEffect(() => {
    if (!user || !targetUserId) return;
    const requestKey = `${targetUserId}:${itemId ?? ""}`;
    if (processedStart.current === requestKey) return;
    processedStart.current = requestKey;
    let active = true;
    void createOrGetConversation(targetUserId, itemId ?? undefined)
      .then(async (id) => {
        await loadConversations();
        if (active) {
          router.replace(`/messages?conversation=${encodeURIComponent(id)}`);
        }
      })
      .catch((openError: unknown) => {
        if (active) {
          setPageError(
            openError instanceof Error
              ? openError.message
              : "Не удалось открыть чат.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [itemId, loadConversations, router, targetUserId, user]);

  useEffect(() => {
    if (!user || !conversationId || isLoadingConversations) return;
    if (!selectedConversationId) return;

    let active = true;

    const refreshMessages = async () => {
      try {
        const nextMessages = await getConversationMessages(conversationId);
        if (active) {
          setMessages(nextMessages);
          setLoadedMessagesFor(conversationId);
          setConversationError("");
        }
      } catch (loadError) {
        if (active) {
          setLoadedMessagesFor(conversationId);
          setConversationError(
            loadError instanceof Error
              ? loadError.message
              : "Не удалось загрузить сообщения.",
          );
        }
      }
    };

    void refreshMessages();
    const unsubscribe = subscribeToConversation(
      conversationId,
      () => {
        void refreshMessages();
        void loadConversations();
      },
      setConversationError,
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [
    conversationId,
    isLoadingConversations,
    loadConversations,
    selectedConversationId,
    user,
  ]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPageError("");
    if (!user) return;

    const username = usernameQuery.trim().replace(/^@/, "");
    if (!isValidUsername(username)) {
      setPageError(t("chat.usernameInvalid"));
      return;
    }

    setIsSearching(true);
    try {
      const profile = await getProfileByUsername(username);
      if (!profile || profile.is_blocked) {
        setPageError(t("chat.noUser"));
      } else {
        await openConversation(profile.id);
      }
    } catch (searchError) {
      setPageError(
        searchError instanceof Error
          ? searchError.message
          : "Не удалось найти пользователя.",
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !conversationId || !selectedConversation || isSending) return;
    const body = draft.trim();
    if (!body) return;
    setIsSending(true);
    setConversationError("");
    try {
      await sendChatMessage(conversationId, user.id, body);
      setDraft("");
      setMessages(await getConversationMessages(conversationId));
      setLoadedMessagesFor(conversationId);
      await loadConversations();
    } catch (sendError) {
      setConversationError(
        sendError instanceof Error
          ? sendError.message
          : "Не удалось отправить сообщение.",
      );
    } finally {
      setIsSending(false);
    }
  }

  const locale = language === "kk" ? "kk-KZ" : language === "en" ? "en-US" : "ru-RU";

  return (
    <main className="foundly-shell container-fluid px-0">
      <SiteHeader active="messages" />
      <section className="messages-page container">
        <div className="messages-heading">
          <span className="section-kicker">{t("nav.messages").toLocaleUpperCase(locale)}</span>
          <h1>{t("chat.title")}</h1>
        </div>

        {!isReady ? (
          <div className="detail-loading">{t("chat.searching")}</div>
        ) : !user ? (
          <Alert severity="info">
            {t("chat.loginRequired")} <Link href={loginHref}>{t("nav.login")}</Link>
          </Alert>
        ) : (
          <>
            {pageError && <Alert className="messages-alert" severity="error">{pageError}</Alert>}
            <div className="messages-layout">
              <aside className="messages-sidebar">
                <form className="messages-search" onSubmit={handleSearch}>
                  <label htmlFor="chat-username">{t("chat.searchPlaceholder")}</label>
                  <div className="messages-search-row">
                    <input
                      autoComplete="off"
                      id="chat-username"
                      maxLength={21}
                      onChange={(event) => setUsernameQuery(event.target.value)}
                      placeholder="@username"
                      value={usernameQuery}
                    />
                    <Button disabled={isSearching} type="submit" variant="contained">
                      {isSearching ? t("chat.searching") : t("chat.search")}
                    </Button>
                  </div>
                </form>

                <div className="messages-list" aria-label={t("chat.title")}>
                  {isLoadingConversations ? (
                    <p className="messages-empty">{t("chat.searching")}</p>
                  ) : conversations.length ? (
                    conversations.map((conversation) => (
                      <Link
                        aria-current={conversation.id === conversationId ? "page" : undefined}
                        className={`messages-list-item${conversation.id === conversationId ? " is-active" : ""}`}
                        href={`/messages?conversation=${encodeURIComponent(conversation.id)}`}
                        key={conversation.id}
                      >
                        <span className="messages-avatar">
                          {conversation.other_profile.avatar_url ? (
                            <span
                              role="img"
                              aria-label={getDisplayName(conversation.other_profile)}
                              style={{ backgroundImage: `url("${conversation.other_profile.avatar_url}")` }}
                            />
                          ) : (
                            getDisplayName(conversation.other_profile).slice(0, 1).toUpperCase()
                          )}
                        </span>
                        <span className="messages-list-copy">
                          <strong>{getDisplayName(conversation.other_profile)}</strong>
                          <small>@{conversation.other_profile.username}</small>
                          <span>{conversation.last_message_preview || t("chat.noMessages")}</span>
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="messages-empty">{t("chat.empty")}</p>
                  )}
                </div>
              </aside>

              <section className="messages-conversation" aria-label={t("chat.title")}>
                {selectedConversation ? (
                  <>
                    <header className="messages-conversation-header">
                      <span className="messages-avatar">
                        {selectedConversation.other_profile.avatar_url ? (
                          <span
                            role="img"
                            aria-label={getDisplayName(selectedConversation.other_profile)}
                            style={{ backgroundImage: `url("${selectedConversation.other_profile.avatar_url}")` }}
                          />
                        ) : (
                          getDisplayName(selectedConversation.other_profile).slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <div>
                        <Link href={`/u/${encodeURIComponent(selectedConversation.other_profile.username)}`}>
                          <strong>{getDisplayName(selectedConversation.other_profile)}</strong>
                        </Link>
                        <span>@{selectedConversation.other_profile.username}</span>
                      </div>
                      {selectedConversation.item_id && (
                        <Link
                          className="messages-item-link"
                          href={`/item/${encodeURIComponent(selectedConversation.item_id)}`}
                        >
                          {t("chat.itemContext")}
                        </Link>
                      )}
                    </header>
                    {(conversationError || isConversationUnavailable) && (
                      <Alert severity="error">
                        {conversationError || "Чат не найден или у вас нет к нему доступа."}
                      </Alert>
                    )}
                    <div className="messages-history" aria-live="polite">
                      {isLoadingMessages ? (
                        <p className="messages-empty">{t("chat.searching")}</p>
                      ) : messages.length ? (
                        <>
                          {messages.length === 500 && (
                            <p className="messages-limit-note">{t("chat.messagesLimit")}</p>
                          )}
                          {messages.map((message) => (
                            <article
                              className={`chat-message${message.sender_id === user.id ? " is-own" : ""}`}
                              key={message.id}
                            >
                              <p>{message.body}</p>
                              <time dateTime={message.created_at}>
                                {new Intl.DateTimeFormat(locale, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }).format(new Date(message.created_at))}
                              </time>
                            </article>
                          ))}
                        </>
                      ) : (
                        <p className="messages-empty">{t("chat.noMessages")}</p>
                      )}
                      <div ref={messagesEnd} />
                    </div>
                    <form className="messages-compose" onSubmit={handleSend}>
                      <textarea
                        aria-label={t("chat.messagePlaceholder")}
                        maxLength={4000}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder={t("chat.messagePlaceholder")}
                        rows={2}
                        value={draft}
                      />
                      <Button disabled={isSending || !draft.trim()} type="submit" variant="contained">
                        {isSending ? t("chat.sending") : t("chat.send")}
                      </Button>
                    </form>
                  </>
                ) : isConversationUnavailable ? (
                  <Alert severity="error">
                    Чат не найден или у вас нет к нему доступа.
                  </Alert>
                ) : (
                  <div className="messages-welcome">
                    <span aria-hidden="true">✉</span>
                    <p>{t("chat.selectConversation")}</p>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
