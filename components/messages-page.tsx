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
import BackLink from "@/components/back-link";
import { useLanguage } from "@/components/language-provider";
import { useDemoAuth } from "@/lib/use-demo-auth";
import {
  createOrGetConversation,
  getConversationMessages,
  getConversations,
  markConversationRead,
  blockChatUser,
  removeChatAttachments,
  reportChat,
  setChatConversationState,
  sendChatMessage,
  uploadChatAttachments,
  subscribeToConversations,
  subscribeToConversation,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/chat";
import { getProfileByUsername, isValidUsername } from "@/lib/profiles";

function getDisplayName(profile: ChatConversation["other_profile"]) {
  return profile.full_name || `@${profile.username}`;
}

function getMessageDayKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getMessageDayLabel(value: string, locale: string, t: (key: string) => string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (getMessageDayKey(value) === getMessageDayKey(today.toISOString())) return t("chat.today");
  if (getMessageDayKey(value) === getMessageDayKey(yesterday.toISOString())) return t("chat.yesterday");
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(date);
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
  const [fileDraft, setFileDraft] = useState<{ conversationId: string; files: File[] } | null>(null);
  const [filter, setFilter] = useState<"all" | "lost" | "found" | "saved" | "archived">("all");
  const [pageError, setPageError] = useState("");
  const [conversationError, setConversationError] = useState("");
  const [conversationNotice, setConversationNotice] = useState("");
  const [loadedConversationUserId, setLoadedConversationUserId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadedMessagesFor, setLoadedMessagesFor] = useState<string | null>(null);
  const processedStart = useRef("");
  const attachmentInput = useRef<HTMLInputElement>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);

  const conversationId = searchParams.get("conversation");
  const selectedFiles = fileDraft?.conversationId === conversationId ? fileDraft.files : [];
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
  const visibleConversations = useMemo(
    () => conversations.filter((conversation) => {
      if (conversation.is_deleted) return false;
      if (filter === "archived") return conversation.is_archived;
      if (conversation.is_archived) return false;
      if (filter === "lost") return conversation.item?.type === "lost";
      if (filter === "found") return conversation.item?.type === "found";
      if (filter === "saved") return conversation.is_saved;
      return true;
    }),
    [conversations, filter],
  );
  const unreadConversations = visibleConversations.filter((conversation) => conversation.unread_count > 0);
  const readConversations = visibleConversations.filter((conversation) => conversation.unread_count === 0);
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
      () => void loadConversations(),
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
        await markConversationRead(conversationId);
        if (active) await loadConversations();
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
      () => void refreshMessages(),
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
    if (!body && !selectedFiles.length) return;
    setIsSending(true);
    setConversationError("");
    try {
      const uploaded = selectedFiles.length
        ? await uploadChatAttachments(conversationId, user.id, selectedFiles)
        : [];
      try {
        await sendChatMessage(conversationId, user.id, body, uploaded);
      } catch (sendError) {
        if (uploaded.length) {
          try {
            await removeChatAttachments(uploaded);
          } catch (cleanupError) {
            throw new Error(
              `${sendError instanceof Error ? sendError.message : "Не удалось отправить сообщение."} ${cleanupError instanceof Error ? cleanupError.message : ""}`,
            );
          }
        }
        throw sendError;
      }
      setDraft("");
      setFileDraft(null);
      if (attachmentInput.current) attachmentInput.current.value = "";
      setMessages(await getConversationMessages(conversationId));
      setLoadedMessagesFor(conversationId);
      await markConversationRead(conversationId);
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

  async function updateSelectedConversationState(
    state: { is_saved?: boolean; is_archived?: boolean; is_deleted?: boolean },
  ) {
    if (!selectedConversation) return;
    if (state.is_deleted && !window.confirm(t("chat.deleteConfirm"))) return;
    setConversationError("");
    try {
      await setChatConversationState(selectedConversation.id, state);
      await loadConversations();
      if (state.is_deleted || state.is_archived !== undefined) {
        router.replace("/messages");
      }
    } catch (actionError) {
      setConversationError(
        actionError instanceof Error ? actionError.message : "Не удалось обновить чат.",
      );
    }
  }

  async function handleBlockConversation() {
    if (!user || !selectedConversation || !window.confirm(t("chat.blockConfirm"))) return;
    try {
      await blockChatUser(user.id, selectedConversation.other_profile.id);
      await loadConversations();
      router.replace("/messages");
    } catch (blockError) {
      setConversationError(
        blockError instanceof Error ? blockError.message : "Не удалось заблокировать пользователя.",
      );
    }
  }

  async function handleReportConversation() {
    if (!user || !selectedConversation) return;
    const reason = window.prompt(t("chat.reportPrompt"));
    if (!reason?.trim()) return;
    setConversationNotice("");
    setConversationError("");
    try {
      await reportChat(
        selectedConversation.id,
        user.id,
        selectedConversation.other_profile.id,
        reason,
      );
      setConversationNotice(t("chat.reportSent"));
    } catch (reportError) {
      setConversationError(
        reportError instanceof Error ? reportError.message : "Не удалось отправить жалобу.",
      );
    }
  }

  const locale = language === "kk" ? "kk-KZ" : language === "en" ? "en-US" : "ru-RU";
  const lastOwnMessage = messages.slice().reverse().find(
    (message) => message.sender_id === user?.id,
  );
  const renderConversation = (conversation: ChatConversation) => (
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
        {conversation.item && (
          <small className="messages-list-item-context">{conversation.item.title}</small>
        )}
        <span>{conversation.last_message_preview || t("chat.noMessages")}</span>
      </span>
      {conversation.unread_count > 0 && (
        <span
          className="chat-unread-badge"
          aria-label={`${conversation.unread_count} ${t("chat.unread")}`}
        >
          {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
        </span>
      )}
    </Link>
  );

  return (
    <main className="foundly-shell container-fluid px-0">
      <SiteHeader active="messages" />
      <section className="messages-page container">
        <BackLink />
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

                <div className="messages-list-filters" role="group" aria-label={t("chat.title")}>
                  {([
                    ["all", "chat.filterAll"],
                    ["lost", "chat.filterLost"],
                    ["found", "chat.filterFound"],
                    ["saved", "chat.saved"],
                    ["archived", "chat.filterArchived"],
                  ] as const).map(([value, labelKey]) => (
                    <button
                      aria-pressed={filter === value}
                      className={filter === value ? "is-active" : ""}
                      key={value}
                      onClick={() => setFilter(value)}
                      type="button"
                    >
                      {t(labelKey)}
                    </button>
                  ))}
                </div>
                <div className="messages-list" aria-label={t("chat.title")}>
                  {isLoadingConversations ? (
                    <p className="messages-empty">{t("chat.searching")}</p>
                  ) : visibleConversations.length ? (
                    <>
                      {unreadConversations.length > 0 && (
                        <section aria-label={t("chat.unreadSection")}>
                          <h2 className="messages-list-section-title">{t("chat.unreadSection")}</h2>
                          {unreadConversations.map(renderConversation)}
                        </section>
                      )}
                      {readConversations.length > 0 && (
                        <section aria-label={t("chat.readSection")}>
                          <h2 className="messages-list-section-title">{t("chat.readSection")}</h2>
                          {readConversations.map(renderConversation)}
                        </section>
                      )}
                    </>
                  ) : (
                    <p className="messages-empty">{t("chat.empty")}</p>
                  )}
                </div>
              </aside>

              <section className="messages-conversation" aria-label={t("chat.title")}>
                {selectedConversation ? (
                  <>
                    <div className="messages-conversation-top">
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
                      </header>
                      <div className="messages-conversation-actions">
                        <Button
                          onClick={() => void updateSelectedConversationState({
                            is_saved: !selectedConversation.is_saved,
                          })}
                          size="small"
                          type="button"
                          variant="outlined"
                        >
                          {selectedConversation.is_saved ? t("chat.unsave") : t("chat.save")}
                        </Button>
                        <Button
                          onClick={() => void updateSelectedConversationState({
                            is_archived: !selectedConversation.is_archived,
                          })}
                          size="small"
                          type="button"
                          variant="outlined"
                        >
                          {selectedConversation.is_archived ? t("chat.unarchive") : t("chat.archive")}
                        </Button>
                        <Button
                          onClick={() => void updateSelectedConversationState({ is_deleted: true })}
                          size="small"
                          type="button"
                          variant="outlined"
                        >
                          {t("chat.delete")}
                        </Button>
                        <Button onClick={() => void handleReportConversation()} size="small" type="button" variant="outlined">
                          {t("chat.report")}
                        </Button>
                        <Button onClick={() => void handleBlockConversation()} size="small" type="button" variant="outlined">
                          {t("chat.block")}
                        </Button>
                      </div>
                      {selectedConversation.item && (
                        <Link
                          aria-label={`${t("chat.itemContext")}: ${selectedConversation.item.title}`}
                          className="messages-item-card"
                          href={`/item/${encodeURIComponent(selectedConversation.item.id)}`}
                        >
                          <span className="messages-item-card-photo">
                            {selectedConversation.item.photo ? (
                              <span
                                aria-label={selectedConversation.item.title}
                                role="img"
                                style={{
                                  backgroundImage: `url("${selectedConversation.item.photo}")`,
                                }}
                              />
                            ) : (
                              <span aria-hidden="true">⌕</span>
                            )}
                          </span>
                          <span className="messages-item-card-copy">
                            <strong>{selectedConversation.item.title}</strong>
                            <small>
                              {selectedConversation.item.price === null
                                ? t("chat.priceUnavailable")
                                : new Intl.NumberFormat(locale, {
                                    style: "currency",
                                    currency: "KZT",
                                    maximumFractionDigits: 2,
                                  }).format(selectedConversation.item.price)}
                            </small>
                          </span>
                        </Link>
                      )}
                    </div>
                    {(conversationError || isConversationUnavailable) && (
                      <Alert severity="error">
                        {conversationError || "Чат не найден или у вас нет к нему доступа."}
                      </Alert>
                    )}
                    {conversationNotice && <Alert severity="success">{conversationNotice}</Alert>}
                    <div className="messages-history" aria-live="polite">
                      {isLoadingMessages ? (
                        <p className="messages-empty">{t("chat.searching")}</p>
                      ) : messages.length ? (
                        <>
                          {messages.length === 500 && (
                            <p className="messages-limit-note">{t("chat.messagesLimit")}</p>
                          )}
                          {messages.map((message, index) => {
                            const previous = messages[index - 1];
                            const isOwn = message.sender_id === user.id;
                            const isRead = Date.parse(message.created_at) <=
                              Date.parse(selectedConversation.other_last_read_at);
                            return (
                              <div className="chat-message-group" key={message.id}>
                                {(!previous || getMessageDayKey(previous.created_at) !== getMessageDayKey(message.created_at)) && (
                                  <div className="messages-date-divider">
                                    <span>{getMessageDayLabel(message.created_at, locale, t)}</span>
                                  </div>
                                )}
                                <article className={`chat-message${isOwn ? " is-own" : ""}`}>
                                  {message.body && <p>{message.body}</p>}
                                  {message.attachments.map((attachment) => (
                                    <a
                                      className="chat-attachment"
                                      href={attachment.url}
                                      key={attachment.url}
                                      rel="noreferrer"
                                      target="_blank"
                                    >
                                      {attachment.content_type.startsWith("image/") ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img alt={attachment.name} src={attachment.url} />
                                      ) : (
                                        <span>{attachment.name} · PDF</span>
                                      )}
                                    </a>
                                  ))}
                                  <div className="chat-message-meta">
                                    <time dateTime={message.created_at}>
                                      {new Intl.DateTimeFormat(locale, {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }).format(new Date(message.created_at))}
                                    </time>
                                    {isOwn && lastOwnMessage?.id === message.id && (
                                      <span>{isRead ? t("chat.readReceipt") : t("chat.sentReceipt")}</span>
                                    )}
                                  </div>
                                </article>
                              </div>
                            );
                          })}
                        </>
                      ) : (
                        <p className="messages-empty">{t("chat.noMessages")}</p>
                      )}
                      <div ref={messagesEnd} />
                    </div>
                    <form className="messages-compose" onSubmit={handleSend}>
                      <input
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        aria-label={t("chat.attach")}
                        className="messages-file-input"
                        multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? []);
                          if (!conversationId) return;
                          if (selectedFiles.length + files.length > 5) {
                            setConversationError(t("chat.attachmentLimit"));
                          } else {
                            setFileDraft({
                              conversationId,
                              files: [...selectedFiles, ...files],
                            });
                            setConversationError("");
                          }
                          event.target.value = "";
                        }}
                        ref={attachmentInput}
                        type="file"
                      />
                      <Button
                        aria-label={t("chat.attach")}
                        onClick={() => attachmentInput.current?.click()}
                        type="button"
                        variant="outlined"
                      >
                        +
                      </Button>
                      <textarea
                        aria-label={t("chat.messagePlaceholder")}
                        maxLength={4000}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder={t("chat.messagePlaceholder")}
                        rows={2}
                        value={draft}
                      />
                      <Button disabled={isSending || (!draft.trim() && !selectedFiles.length)} type="submit" variant="contained">
                        {isSending ? t("chat.sending") : t("chat.send")}
                      </Button>
                    </form>
                    {selectedFiles.length > 0 && (
                      <div className="messages-selected-files">
                        {selectedFiles.map((file, index) => (
                          <span key={`${file.name}-${index}`}>
                            {file.name}
                            <button
                              aria-label={`${t("chat.removeAttachment")}: ${file.name}`}
                              onClick={() => setFileDraft((current) =>
                                current?.conversationId === conversationId
                                  ? { ...current, files: current.files.filter((_, fileIndex) => fileIndex !== index) }
                                  : current,
                              )}
                              type="button"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
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
