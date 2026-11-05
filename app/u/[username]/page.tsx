import type { Metadata } from "next";
import { Suspense } from "react";
import UserProfileRoute from "@/components/user-profile-route";

export const metadata: Metadata = {
  title: "Профиль пользователя — Foundly",
  description: "Профиль участника университетского сообщества Foundly.",
};

export default function UserProfilePage() {
  return (
    <Suspense fallback={<main className="detail-loading">Загружаем профиль…</main>}>
      <UserProfileRoute />
    </Suspense>
  );
}
