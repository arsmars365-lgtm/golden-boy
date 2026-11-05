import { Suspense } from "react";
import DemoAuthForm from "@/components/demo-auth-form";

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="detail-loading">Загружаем форму регистрации…</main>}>
      <DemoAuthForm mode="register" />
    </Suspense>
  );
}
