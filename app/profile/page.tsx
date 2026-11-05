import { Suspense } from "react";
import ProfilePage from "@/components/profile-page";

export default function OwnProfilePage() {
  return (
    <Suspense fallback={<main className="profile-edit-page container">Загружаем профиль…</main>}>
      <ProfilePage />
    </Suspense>
  );
}
