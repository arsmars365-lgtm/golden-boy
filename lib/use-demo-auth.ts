"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { DemoUser } from "@/lib/demo-auth";

export function useDemoAuth() {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [error, setError] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    const initialize = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!active) return;
          const account = session?.user;
          setUser(
            account
              ? {
                  id: account.id,
                  name:
                    (typeof account.user_metadata.name === "string" &&
                      account.user_metadata.name) ||
                    account.email ||
                    "Пользователь",
                  email: account.email ?? "",
                }
              : null,
          );
          setError("");
          setIsReady(true);
        });
        unsubscribe = () => data.subscription.unsubscribe();

        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (!active) return;
        if (sessionError) {
          setError(sessionError.message);
          setIsReady(true);
          return;
        }
        const account = sessionData.session?.user;
        setUser(
          account
            ? {
                id: account.id,
                name:
                  (typeof account.user_metadata.name === "string" &&
                    account.user_metadata.name) ||
                  account.email ||
                  "Пользователь",
                email: account.email ?? "",
              }
            : null,
        );
        setIsReady(true);
      } catch (authError) {
        if (!active) return;
        setError(
          authError instanceof Error
            ? authError.message
            : "Не удалось подключиться к Supabase.",
        );
        setIsReady(true);
      }
    };

    void initialize();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { user, error, isReady };
}
