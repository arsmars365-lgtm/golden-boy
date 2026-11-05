"use client";

import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { getSupabaseClient } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("Пароли не совпадают.");
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await getSupabaseClient().auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);
      router.replace("/login");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Не удалось изменить пароль.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="foundly-shell container-fluid px-0"><SiteHeader /><section className="auth-page"><div className="auth-card">
    <span className="section-kicker">НОВЫЙ ПАРОЛЬ</span><h1>Создайте пароль</h1>
    {error && <Alert severity="error">{error}</Alert>}
    <form className="auth-form" onSubmit={submit}>
      <label className="form-group"><span className="form-label">Новый пароль</span><input autoComplete="new-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
      <label className="form-group"><span className="form-label">Повторите пароль</span><input autoComplete="new-password" minLength={8} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} /></label>
      <Button disabled={saving} type="submit" variant="contained">{saving ? "Сохраняем…" : "Сохранить пароль"}</Button>
    </form>
    <p className="auth-switch"><Link href="/login">Войти</Link></p>
  </div></section><SiteFooter /></main>;
}
