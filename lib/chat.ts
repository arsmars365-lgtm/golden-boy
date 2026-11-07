"use client";

import { getSupabaseClient } from "@/lib/supabase";

export type ChatProfile = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
};

export type ChatListingPreview = {
  id: string;
  user_id: string;
  type: "lost" | "found";
  title: string;
  photo: string | null;
  price: number | null;
};

export type ChatAttachment = {
  path: string;
  name: string;
  content_type: string;
  size: number;
};

export type ChatAttachmentView = Omit<ChatAttachment, "path"> & {
  url: string;
};

export type ChatConversation = {
  id: string;
  participant_1: string;
  participant_2: string;
  item_id: string | null;
  last_message_preview: string;
  updated_at: string;
  participant_1_last_read_at: string;
  participant_2_last_read_at: string;
  other_last_read_at: string;
  is_saved: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  other_profile: ChatProfile;
  item: ChatListingPreview | null;
  unread_count: number;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  attachments: ChatAttachmentView[];
};

type ConversationRow = Omit<
  ChatConversation,
  | "other_profile"
  | "item"
  | "unread_count"
  | "other_last_read_at"
  | "is_saved"
  | "is_archived"
  | "is_deleted"
>;

type UnreadCountRow = {
  conversation_id: string;
  unread_count: number | string;
};

export async function getConversations(userId: string): Promise<ChatConversation[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id,participant_1,participant_2,item_id,last_message_preview,updated_at,participant_1_last_read_at,participant_2_last_read_at")
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Не удалось загрузить список чатов: ${error.message}`);

  const rows = (data ?? []) as ConversationRow[];
  if (!rows.length) return [];

  const otherIds = rows.map((row) =>
    row.participant_1 === userId ? row.participant_2 : row.participant_1,
  );
  const itemIds = [...new Set(rows.flatMap((row) => row.item_id ? [row.item_id] : []))];
  const [profilesResult, unreadResult, stateResult, blocksResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,username,full_name,avatar_url")
      .in("id", otherIds),
    supabase.rpc("get_unread_chat_counts"),
    supabase
      .from("chat_conversation_state")
      .select("conversation_id,is_saved,is_archived,is_deleted")
      .eq("user_id", userId),
    supabase
      .from("chat_user_blocks")
      .select("blocked_id")
      .eq("blocker_id", userId),
  ]);
  const { data: profiles, error: profilesError } = profilesResult;

  if (profilesError) {
    throw new Error(`Не удалось загрузить участников чатов: ${profilesError.message}`);
  }
  if (unreadResult.error) {
    throw new Error(`Не удалось загрузить непрочитанные сообщения: ${unreadResult.error.message}`);
  }
  if (stateResult.error) {
    throw new Error(`Не удалось загрузить настройки чатов: ${stateResult.error.message}`);
  }
  if (blocksResult.error) {
    throw new Error(`Не удалось загрузить заблокированных пользователей: ${blocksResult.error.message}`);
  }

  const { data: listings, error: listingsError } = itemIds.length
    ? await supabase
        .from("items")
        .select("id,user_id,type,title,photos,price")
        .in("id", itemIds)
    : { data: [], error: null };
  if (listingsError) {
    throw new Error(`Не удалось загрузить объявления чатов: ${listingsError.message}`);
  }

  const profilesById = new Map(
    ((profiles ?? []) as ChatProfile[]).map((profile) => [profile.id, profile]),
  );
  const listingsById = new Map(
    ((listings ?? []) as Array<{
      id: string;
      user_id: string;
      type: "lost" | "found";
      title: string;
      photos: string[];
      price: number | string | null;
    }>).map((listing) => [
      listing.id,
      {
        id: listing.id,
        user_id: listing.user_id,
        type: listing.type,
        title: listing.title,
        photo: listing.photos[0] ?? null,
        price: listing.price == null ? null : Number(listing.price),
      } satisfies ChatListingPreview,
    ]),
  );
  const unreadByConversationId = new Map(
    ((unreadResult.data ?? []) as UnreadCountRow[]).map((row) => [
      row.conversation_id,
      Number(row.unread_count),
    ]),
  );
  const stateByConversationId = new Map(
    (stateResult.data ?? []).map((state) => [state.conversation_id, state]),
  );
  const blockedUserIds = new Set((blocksResult.data ?? []).map((block) => block.blocked_id));

  return rows.flatMap((row) => {
    const otherId =
      row.participant_1 === userId ? row.participant_2 : row.participant_1;
    if (blockedUserIds.has(otherId)) return [];
    const otherProfile = profilesById.get(otherId);
    if (!otherProfile) {
      throw new Error("Не удалось найти профиль собеседника.");
    }
    const listing = row.item_id ? listingsById.get(row.item_id) ?? null : null;
    if (listing && listing.price !== null && !Number.isFinite(listing.price)) {
      throw new Error("У объявления в чате указана некорректная цена.");
    }
    const unreadCount = unreadByConversationId.get(row.id) ?? 0;
    if (!Number.isSafeInteger(unreadCount) || unreadCount < 0) {
      throw new Error("Сервер вернул некорректное количество непрочитанных сообщений.");
    }
    const state = stateByConversationId.get(row.id);
    return [{
      ...row,
      other_last_read_at:
        row.participant_1 === userId
          ? row.participant_2_last_read_at
          : row.participant_1_last_read_at,
      is_saved: state?.is_saved ?? false,
      is_archived: state?.is_archived ?? false,
      is_deleted: state?.is_deleted ?? false,
      other_profile: otherProfile,
      item: listing,
      unread_count: unreadCount,
    }];
  });
}

export async function getUnreadChatCount(): Promise<number> {
  const { data, error } = await getSupabaseClient().rpc("get_unread_chat_counts");
  if (error) {
    throw new Error(`Не удалось загрузить непрочитанные сообщения: ${error.message}`);
  }
  return ((data ?? []) as UnreadCountRow[]).reduce((total, row) => {
    const count = Number(row.unread_count);
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error("Сервер вернул некорректное количество непрочитанных сообщений.");
    }
    const nextTotal = total + count;
    if (!Number.isSafeInteger(nextTotal)) {
      throw new Error("Слишком большое количество непрочитанных сообщений.");
    }
    return nextTotal;
  }, 0);
}

export async function createOrGetConversation(
  otherUserId: string,
  itemId?: string,
): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc(
    "create_or_get_conversation",
    {
      p_other_user_id: otherUserId,
      p_item_id: itemId ?? null,
    },
  );

  if (error) throw new Error(`Не удалось открыть чат: ${error.message}`);
  if (typeof data !== "string") {
    throw new Error("Не удалось получить идентификатор чата.");
  }
  return data;
}

export async function getConversationMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  const { data, error } = await getSupabaseClient()
    .from("messages")
    .select("id,conversation_id,sender_id,body,created_at,attachments")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(`Не удалось загрузить сообщения: ${error.message}`);
  const rows = (data ?? []) as Array<Omit<ChatMessage, "attachments"> & {
    attachments: ChatAttachment[];
  }>;
  const storage = getSupabaseClient().storage.from("chat-attachments");
  return Promise.all(rows.reverse().map(async (message) => {
    const attachments = await Promise.all(message.attachments.map(async (attachment) => {
      const { data: signedUrl, error: signedUrlError } = await storage.createSignedUrl(
        attachment.path,
        3600,
      );
      if (signedUrlError) {
        throw new Error(`Не удалось открыть вложение: ${signedUrlError.message}`);
      }
      return {
        name: attachment.name,
        content_type: attachment.content_type,
        size: attachment.size,
        url: signedUrl.signedUrl,
      };
    }));
    return { ...message, attachments };
  }));
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
  });
  if (error) throw new Error(`Не удалось отметить чат прочитанным: ${error.message}`);
}

export async function sendChatMessage(
  conversationId: string,
  senderId: string,
  body: string,
  attachments: ChatAttachment[] = [],
): Promise<void> {
  const normalizedBody = body.trim();
  if ((!normalizedBody && !attachments.length) || normalizedBody.length > 4000) {
    throw new Error("Сообщение должно содержать от 1 до 4000 символов.");
  }
  if (attachments.length > 5) throw new Error("Можно прикрепить не более 5 файлов.");

  const { error } = await getSupabaseClient().from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body: normalizedBody,
    attachments,
  });

  if (error) throw new Error(`Не удалось отправить сообщение: ${error.message}`);
}

const CHAT_ATTACHMENT_LIMIT = 10 * 1024 * 1024;
const CHAT_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export async function uploadChatAttachments(
  conversationId: string,
  userId: string,
  files: File[],
): Promise<ChatAttachment[]> {
  if (files.length > 5) throw new Error("Можно прикрепить не более 5 файлов.");
  for (const file of files) {
    if (!CHAT_ATTACHMENT_TYPES.has(file.type)) {
      throw new Error("Поддерживаются изображения JPG, PNG, WebP и PDF.");
    }
    if (file.size <= 0 || file.size > CHAT_ATTACHMENT_LIMIT) {
      throw new Error("Размер каждого файла не должен превышать 10 МБ.");
    }
  }

  const storage = getSupabaseClient().storage.from("chat-attachments");
  const uploaded: ChatAttachment[] = [];
  try {
    for (const file of files) {
      const safeName = file.name.replace(/[^\w.-]/g, "_").slice(0, 100) || "file";
      const path = `${conversationId}/${userId}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await storage.upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw new Error(`Не удалось загрузить файл: ${error.message}`);
      uploaded.push({
        path,
        name: file.name,
        content_type: file.type,
        size: file.size,
      });
    }
  } catch (uploadError) {
    if (uploaded.length) {
      const { error: cleanupError } = await storage.remove(uploaded.map(({ path }) => path));
      if (cleanupError) {
        throw new Error(
          `${uploadError instanceof Error ? uploadError.message : "Не удалось загрузить файл."} Также не удалось удалить незавершённые вложения: ${cleanupError.message}`,
        );
      }
    }
    throw uploadError;
  }
  return uploaded;
}

export async function removeChatAttachments(attachments: ChatAttachment[]): Promise<void> {
  if (!attachments.length) return;
  const { error } = await getSupabaseClient()
    .storage
    .from("chat-attachments")
    .remove(attachments.map(({ path }) => path));
  if (error) throw new Error(`Не удалось удалить временные вложения: ${error.message}`);
}

export async function setChatConversationState(
  conversationId: string,
  state: { is_saved?: boolean; is_archived?: boolean; is_deleted?: boolean },
): Promise<void> {
  const { error } = await getSupabaseClient().rpc("set_chat_conversation_state", {
    p_conversation_id: conversationId,
    p_is_saved: state.is_saved ?? null,
    p_is_archived: state.is_archived ?? null,
    p_is_deleted: state.is_deleted ?? null,
  });
  if (error) throw new Error(`Не удалось обновить чат: ${error.message}`);
}

export async function blockChatUser(userId: string, blockedId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("chat_user_blocks")
    .insert({ blocker_id: userId, blocked_id: blockedId });
  if (error) throw new Error(`Не удалось заблокировать пользователя: ${error.message}`);
}

export async function reportChat(
  conversationId: string,
  userId: string,
  reportedUserId: string,
  reason: string,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("chat_reports")
    .insert({
      conversation_id: conversationId,
      reporter_id: userId,
      reported_user_id: reportedUserId,
      reason: reason.trim(),
    });
  if (error) throw new Error(`Не удалось отправить жалобу: ${error.message}`);
}

export function subscribeToConversations(
  userId: string,
  onChange: () => void,
  onError: (message: string) => void,
  onSubscribed?: () => void,
): () => void {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`conversations:${userId}:${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "conversations",
        filter: `participant_1=eq.${userId}`,
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "conversations",
        filter: `participant_2=eq.${userId}`,
      },
      onChange,
    )
    .subscribe((status, error) => {
      if (status === "SUBSCRIBED") onSubscribed?.();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onError(error?.message ?? "Не удалось подключиться к обновлениям списка чатов.");
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToConversation(
  conversationId: string,
  onMessage: () => void,
  onError: (message: string) => void,
  onSubscribed?: () => void,
): () => void {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`conversation:${conversationId}:${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      onMessage,
    )
    .subscribe((status, error) => {
      if (status === "SUBSCRIBED") onSubscribed?.();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onError(error?.message ?? "Не удалось подключиться к обновлениям чата.");
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
