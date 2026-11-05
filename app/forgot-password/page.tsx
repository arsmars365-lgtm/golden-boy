"use client";

import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "next/link";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { getSupabaseClient } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { error: resetError } = await getSupabaseClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw new Error(resetError.message);
      setSent(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось отправить письмо.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="foundly-shell container-fluid px-0"><SiteHeader /><section className="auth-page"><div className="auth-card">
    <span className="section-kicker">ВОССТАНОВЛЕНИЕ ДОСТУПА</span><h1>Сброс пароля</h1>
    <p className="auth-intro">Отправим на вашу почту ссылку для создания нового пароля.</p>
    {error && <Alert severity="error">{error}</Alert>}
    {sent ? <Alert severity="success">Проверьте почту и перейдите по ссылке из письма.</Alert> : <form className="auth-form" onSubmit={submit}>
      <label className="form-group"><span className="form-label">Email</span><input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
      <Button disabled={saving} type="submit" variant="contained">{saving ? "Отправляем…" : "Отправить ссылку"}</Button>
    </form>}
    <p className="auth-switch"><Link href="/login">Вернуться ко входу</Link></p>
  </div></section><SiteFooter /></main>;
}
