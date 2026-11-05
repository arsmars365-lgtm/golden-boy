import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

export type DemoUser = {
  id: string;
  name: string;
  email: string;
};

function toDemoUser(user: User): DemoUser {
  return {
    id: user.id,
    name:
      (typeof user.user_metadata.name === "string" && user.user_metadata.name) ||
      user.email ||
      "Пользователь",
    email: user.email ?? "",
  };
}

export async function registerDemoUser(
  name: string,
  email: string,
  password: string,
): Promise<{ user: DemoUser; needsEmailConfirmation: boolean }> {
  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLocaleLowerCase("en-US");
  if (normalizedName.length < 2 || normalizedName.length > 60) {
    throw new Error("Имя должно содержать от 2 до 60 символов.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Укажи корректный адрес электронной почты.");
  }
  if (password.length < 8 || password.length > 128) {
    throw new Error("Пароль должен содержать от 8 до 128 символов.");
  }

  const { data, error } = await getSupabaseClient().auth.signUp({
    email: normalizedEmail,
    password,
    options: { data: { name: normalizedName } },
  });

  if (error) throw new Error(`Не удалось создать аккаунт: ${error.message}`);
  if (!data.user) throw new Error("Supabase не вернул созданный аккаунт.");

  return {
    user: toDemoUser(data.user),
    needsEmailConfirmation: !data.session,
  };
}

export async function loginDemoUser(
  email: string,
  password: string,
): Promise<DemoUser> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: email.trim().toLocaleLowerCase("en-US"),
    password,
  });

  if (error) throw new Error(`Не удалось войти: ${error.message}`);
  if (!data.user) throw new Error("Supabase не вернул пользователя.");
  return toDemoUser(data.user);
}

export async function logoutDemoUser(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw new Error(`Не удалось выйти из аккаунта: ${error.message}`);
}
