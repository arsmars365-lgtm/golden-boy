import { Suspense } from "react";
import AddItemForm from "@/components/add-item-form";

export default function AddItemPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="foundly-shell container-fluid px-0">
          <section className="auth-required-state container">
            <p>Загружаем форму объявления...</p>
          </section>
        </main>
      }
    >
      <AddItemForm searchParams={searchParams} />
    </Suspense>
  );
}
