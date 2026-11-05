import { Suspense } from "react";
import DemoAuthForm from "@/components/demo-auth-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="detail-loading">Загружаем форму входа…</main>}>
      <DemoAuthForm mode="login" />
    </Suspense>
  );
}
