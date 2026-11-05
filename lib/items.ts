import { getSupabaseClient } from "@/lib/supabase";

export type ItemType = "lost" | "found";
export type ItemStatus = "searching" | "found" | "returned";

export type Item = {
  id: string;
  title: string;
  category: string;
  type: ItemType;
  place: string;
  date?: string;
  createdAt?: string;
  daysAgo: number;
  time: string;
  status: ItemStatus;
  art: string;
  symbol: string;
  details: string;
  imageDataUrl?: string;
  imageDataUrls?: string[];
  ownerId?: string;
  ownerUsername?: string;
  ownerFullName?: string;
  ownerVerified?: boolean;
};

export type ItemReport = {
  id: string;
  itemId: string;
  reason: string;
  createdAt: string;
};

export const ITEM_CATEGORIES = [
  "Документы",
  "Телефон",
  "Ключи",
  "Наушники",
  "Одежда",
  "Сумки",
  "Другое",
  "Электроника",
  "Книги",
] as const;

export const DEMO_ITEMS: Item[] = [
  {
    id: "blue-headphones",
    title: "Наушники Sony",
    category: "Электроника",
    type: "lost",
    place: "Библиотека, 2 этаж",
    daysAgo: 0,
    time: "12:40",
    status: "searching",
    art: "art-blue",
    symbol: "♫",
    details:
      "Синие беспроводные наушники в чехле. Последний раз видел(а) в читальном зале.",
  },
  {
    id: "student-card",
    title: "Студенческий билет",
    category: "Документы",
    type: "found",
    place: "Главный корпус, холл",
    daysAgo: 0,
    time: "11:15",
    status: "searching",
    art: "art-peach",
    symbol: "ID",
    details:
      "Нашёл(ла) студенческий билет у входа в главный корпус. Передал(а) на стойку охраны.",
  },
  {
    id: "keychain",
    title: "Связка ключей с брелоком",
    category: "Ключи",
    type: "found",
    place: "Корпус Б, аудитория 204",
    daysAgo: 1,
    time: "16:20",
    status: "searching",
    art: "art-green",
    symbol: "✳",
    details:
      "Три ключа на кольце и небольшой зелёный брелок. Оставил(а) у охраны корпуса.",
  },
  {
    id: "black-backpack",
    title: "Чёрный рюкзак",
    category: "Сумки",
    type: "lost",
    place: "Спортивный зал",
    daysAgo: 2,
    time: "18:05",
    status: "searching",
    art: "art-lilac",
    symbol: "▣",
    details:
      "Небольшой чёрный рюкзак с нашивкой. Внутри были конспекты и зарядка.",
  },
  {
    id: "chemistry-notes",
    title: "Тетрадь по химии",
    category: "Книги",
    type: "found",
    place: "Кафетерий",
    daysAgo: 3,
    time: "13:30",
    status: "returned",
    art: "art-yellow",
    symbol: "✎",
    details:
      "Клетчатая тетрадь с записями по органической химии. Уже ждёт владельца у администратора.",
  },
  {
    id: "silver-ring",
    title: "Серебряное кольцо",
    category: "Другое",
    type: "found",
    place: "Корпус А, аудитория 108",
    daysAgo: 5,
    time: "10:10",
    status: "searching",
    art: "art-rose",
    symbol: "○",
    details:
      "Небольшое серебристое кольцо найдено после пары. Напишите, если это ваша вещь.",
  },
];

type ItemRow = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  type: ItemType;
  location: string;
  date: string;
  photos: string[];
  status: "active" | "returned" | "hidden";
  description: string;
  created_at: string;
  profiles: {
    username: string;
    full_name: string;
    is_verified: boolean;
  } | null;
};

function notifyItemsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("foundly-items-updated"));
  }
}

function fromItemRow(row: ItemRow): Item {
  const { art, symbol } = getItemArt(row.category);
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    type: row.type,
    place: row.location,
    date: row.date,
    createdAt: row.created_at,
    daysAgo: getDaysAgo(row.date),
    time: new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(row.created_at)),
    status: row.status === "returned" ? "returned" : "searching",
    art,
    symbol,
    details: row.description,
    ...(row.photos[0]
      ? { imageDataUrl: row.photos[0], imageDataUrls: row.photos }
      : {}),
    ownerId: row.user_id,
    ownerUsername: row.profiles?.username,
    ownerFullName: row.profiles?.full_name,
    ownerVerified: row.profiles?.is_verified ?? false,
  };
}

const itemSelection =
  "id,user_id,title,category,type,location,date,photos,status,description,created_at,profiles!items_user_profile_fkey(username,full_name,is_verified)";

export async function getStoredItems(): Promise<Item[]> {
  const { data, error } = await getSupabaseClient()
    .from("items")
    .select(itemSelection)
    .neq("status", "hidden")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Не удалось загрузить объявления: ${error.message}`);
  return (data as unknown as ItemRow[]).map(fromItemRow);
}

export function getAllItems(storedItems: Item[] = []): Item[] {
  return [...storedItems, ...DEMO_ITEMS];
}

export async function saveItem(item: Item): Promise<void> {
  const supabase = getSupabaseClient();
  const photos: string[] = [];
  const uploadedPaths: string[] = [];

  try {
    for (const [index, imageDataUrl] of (item.imageDataUrls ??
      (item.imageDataUrl ? [item.imageDataUrl] : [])
    ).entries()) {
      if (!imageDataUrl.startsWith("data:image/")) {
        photos.push(imageDataUrl);
        continue;
      }
      const response = await fetch(imageDataUrl);
      if (!response.ok) throw new Error("Не удалось обработать фотографию.");
      const blob = await response.blob();
      const path = `${item.ownerId}/${item.id}-${index}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("item-photos")
        .upload(path, blob, { contentType: blob.type, upsert: false });
      if (uploadError) throw new Error(`Не удалось загрузить фотографию: ${uploadError.message}`);
      uploadedPaths.push(path);
      photos.push(supabase.storage.from("item-photos").getPublicUrl(path).data.publicUrl);
    }

    const { error } = await supabase.from("items").insert({
    id: item.id,
    title: item.title,
    category: item.category,
    type: item.type,
    location: item.place,
    date: item.date ?? new Date().toISOString().slice(0, 10),
    status: item.status === "returned" ? "returned" : "active",
    description: item.details,
    photos,
    user_id: item.ownerId,
    });

    if (error) throw new Error(`Не удалось сохранить объявление: ${error.message}`);
  } catch (saveError) {
    if (uploadedPaths.length) {
      const { error: cleanupError } = await supabase.storage
        .from("item-photos")
        .remove(uploadedPaths);
      if (cleanupError) {
        throw new Error(
          `${saveError instanceof Error ? saveError.message : "Не удалось сохранить объявление."} Также не удалось удалить загруженные фото: ${cleanupError.message}`,
        );
      }
    }
    throw saveError;
  }
  notifyItemsChanged();
}

export async function updateStoredItem(
  id: string,
  ownerId: string,
  updates: Partial<Pick<Item, "status" | "title" | "category" | "type" | "place" | "date" | "details">>,
): Promise<Item> {
  const databaseUpdates: Record<string, string> = {};
  if (updates.status) {
    databaseUpdates.status = updates.status === "returned" ? "returned" : "active";
  }
  if (updates.title !== undefined) databaseUpdates.title = updates.title.trim();
  if (updates.category !== undefined) databaseUpdates.category = updates.category;
  if (updates.type !== undefined) databaseUpdates.type = updates.type;
  if (updates.place !== undefined) databaseUpdates.location = updates.place.trim();
  if (updates.date !== undefined) databaseUpdates.date = updates.date;
  if (updates.details !== undefined) databaseUpdates.description = updates.details.trim();
  const { data, error } = await getSupabaseClient()
    .from("items")
    .update(databaseUpdates)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select(itemSelection)
    .maybeSingle();

  if (error) throw new Error(`Не удалось обновить объявление: ${error.message}`);
  if (!data) throw new Error("Объявление не найдено или у тебя нет прав на изменение.");
  notifyItemsChanged();
  return fromItemRow(data as unknown as ItemRow);
}

export async function deleteStoredItem(id: string, ownerId: string): Promise<void> {
  const { data, error } = await getSupabaseClient()
    .from("items")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Не удалось удалить объявление: ${error.message}`);
  if (!data) throw new Error("Объявление не найдено или у тебя нет прав на удаление.");
  notifyItemsChanged();
}

export async function saveItemReport(
  itemId: string,
  reason: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Не удалось проверить аккаунт: ${authError.message}`);
  if (!userData.user) throw new Error("Чтобы отправить жалобу, войди в аккаунт.");

  const { error } = await supabase
    .from("reports")
    .insert({ item_id: itemId, reason, user_id: userData.user.id });

  if (error) throw new Error(`Не удалось отправить жалобу: ${error.message}`);
}

export function getItemArt(category: string): { art: string; symbol: string } {
  switch (category) {
    case "Электроника":
      return { art: "art-blue", symbol: "♫" };
    case "Документы":
      return { art: "art-peach", symbol: "ID" };
    case "Ключи":
      return { art: "art-green", symbol: "✳" };
    case "Одежда":
      return { art: "art-lilac", symbol: "◈" };
    case "Сумки":
      return { art: "art-lilac", symbol: "▣" };
    case "Книги":
      return { art: "art-yellow", symbol: "✎" };
    default:
      return { art: "art-rose", symbol: "○" };
  }
}

export function formatItemDate(
  daysAgo: number,
  time: string,
  language: "ru" | "kk" | "en" = "ru",
): string {
  if (daysAgo === 0) {
    return language === "en"
      ? `Today, ${time}`
      : language === "kk"
        ? `Бүгін, ${time}`
        : `Сегодня, ${time}`;
  }
  if (daysAgo === 1) {
    return language === "en"
      ? `Yesterday, ${time}`
      : language === "kk"
        ? `Кеше, ${time}`
        : `Вчера, ${time}`;
  }
  if (language === "en") return `${daysAgo} day${daysAgo > 1 ? "s" : ""} ago, ${time}`;
  if (language === "kk") return `${daysAgo} күн бұрын, ${time}`;
  return `${daysAgo} ${daysAgo < 5 ? "дня" : "дней"} назад, ${time}`;
}

export function getDaysAgo(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const selected = Date.UTC(year, month - 1, day);
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return Math.max(0, Math.floor((todayUtc - selected) / 86_400_000));
}

export function isStoredItem(
  id: string,
  storedItems: Item[],
  ownerId?: string,
): boolean {
  return storedItems.some(
    (item) =>
      item.id === id &&
      typeof ownerId === "string" &&
      item.ownerId === ownerId,
  );
}
