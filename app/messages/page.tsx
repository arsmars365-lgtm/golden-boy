import { Suspense } from "react";
import MessagesPage from "@/components/messages-page";

export default function MessagesRoute() {
  return (
    <Suspense fallback={<main className="detail-loading">Загружаем чаты…</main>}>
      <MessagesPage />
    </Suspense>
  );
}
