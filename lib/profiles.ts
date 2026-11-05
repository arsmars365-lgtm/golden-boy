import { getSupabaseClient } from "@/lib/supabase";

export type Profile = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  bio: string;
  faculty: string;
  course: number | null;
  role: "user" | "admin";
  is_verified: boolean;
  is_blocked: boolean;
  created_at: string;
};

export function isValidUsername(value: string) {
  return /^[A-Za-z0-9_]{3,20}$/.test(value);
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  if (!isValidUsername(username)) return null;
  const { data, error } = await getSupabaseClient()
    .from("profiles")
    .select("id,username,full_name,avatar_url,bio,faculty,course,role,is_verified,is_blocked,created_at")
    .ilike("username", username)
    .maybeSingle();

  if (error) throw new Error(`Не удалось загрузить профиль: ${error.message}`);
  return data as Profile | null;
}

export async function getCurrentProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabaseClient()
    .from("profiles")
    .select("id,username,full_name,avatar_url,bio,faculty,course,role,is_verified,is_blocked,created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`Не удалось загрузить профиль: ${error.message}`);
  return data as Profile | null;
}

export async function getProfileItems(userId: string) {
  const { data, error } = await getSupabaseClient()
    .from("items")
    .select("id,user_id,title,category,type,location,date,photos,status,description,created_at,profiles!items_user_profile_fkey(username,full_name,is_verified)")
    .eq("user_id", userId)
    .neq("status", "hidden")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Не удалось загрузить объявления профиля: ${error.message}`);
  return data;
}
