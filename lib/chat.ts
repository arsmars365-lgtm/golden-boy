"use client";

import { getSupabaseClient } from "@/lib/supabase";

export type ChatProfile = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
};

export type ChatConversation = {
  id: string;
  participant_1: string;
  participant_2: string;
  item_id: string | null;
  last_message_preview: string;
  updated_at: string;
  other_profile: ChatProfile;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type ConversationRow = Omit<ChatConversation, "other_profile">;

export async function getConversations(userId: string): Promise<ChatConversation[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id,participant_1,participant_2,item_id,last_message_preview,updated_at")
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Не удалось загрузить список чатов: ${error.message}`);

  const rows = (data ?? []) as ConversationRow[];
  if (!rows.length) return [];

  const otherIds = rows.map((row) =>
    row.participant_1 === userId ? row.participant_2 : row.participant_1,
  );
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id,username,full_name,avatar_url")
    .in("id", otherIds);

  if (profilesError) {
    throw new Error(`Не удалось загрузить участников чатов: ${profilesError.message}`);
  }

  const profilesById = new Map(
    ((profiles ?? []) as ChatProfile[]).map((profile) => [profile.id, profile]),
  );

  return rows.map((row) => {
    const otherId =
      row.participant_1 === userId ? row.participant_2 : row.participant_1;
    const otherProfile = profilesById.get(otherId);
    if (!otherProfile) {
      throw new Error("Не удалось найти профиль собеседника.");
    }
    return { ...row, other_profile: otherProfile };
  });
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
    .select("id,conversation_id,sender_id,body,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) throw new Error(`Не удалось загрузить сообщения: ${error.message}`);
  return (data ?? []) as ChatMessage[];
}

export async function sendChatMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<void> {
  const normalizedBody = body.trim();
  if (!normalizedBody || normalizedBody.length > 4000) {
    throw new Error("Сообщение должно содержать от 1 до 4000 символов.");
  }

  const { error } = await getSupabaseClient().from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body: normalizedBody,
  });

  if (error) throw new Error(`Не удалось отправить сообщение: ${error.message}`);
}

export function subscribeToConversations(
  userId: string,
  onChange: () => void,
  onError: (message: string) => void,
): () => void {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`conversations:${userId}`)
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
): () => void {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`conversation:${conversationId}`)
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
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onError(error?.message ?? "Не удалось подключиться к обновлениям чата.");
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
