"use client";

import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { loginDemoUser, registerDemoUser } from "@/lib/demo-auth";

type DemoAuthFormProps = {
  mode: "login" | "register";
};

export default function DemoAuthForm({ mode }: DemoAuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRegister = mode === "register";
  const requestedPath = searchParams.get("next");
  const redirectPath =
    requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
      ? requestedPath
      : "/";
  const authSwitchPath = isRegister ? "/login" : "/register";
  const authSwitchHref = requestedPath
    ? `${authSwitchPath}?next=${encodeURIComponent(redirectPath)}`
    : authSwitchPath;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (isRegister && password !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegister) {
        const result = await registerDemoUser(name, email, password);
        if (result.needsEmailConfirmation) {
          setSuccess("Аккаунт создан. Подтверди email по ссылке из письма, затем войди.");
          setIsSubmitting(false);
          return;
        }
      } else {
        await loginDemoUser(email, password);
      }
      router.replace(redirectPath);
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Не удалось выполнить действие. Проверь хранилище браузера.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="foundly-shell container-fluid px-0">
      <SiteHeader />

      <section className="auth-page">
        <div className="auth-card">
          <Link className="auth-brand" href="/" aria-label="Foundly — главная">
            <span className="brand-mark">f</span>
            <span>foundly</span>
          </Link>

          <span className="section-kicker">СООБЩЕСТВО КАМПУСА</span>
          <h1>{isRegister ? "Создать аккаунт" : "С возвращением!"}</h1>
          <p className="auth-intro">
            {isRegister
              ? "Зарегистрируйся, чтобы публиковать объявления и помогать вещам находиться."
              : "Войди, чтобы управлять своими объявлениями."}
          </p>

          {error && (
            <Alert className="form-error" severity="error">
              {error}
            </Alert>
          )}
          {success && <Alert severity="success">{success}</Alert>}

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && (
              <label className="form-group">
                <span className="form-label">
                  Имя <span>*</span>
                </span>
                <input
                  autoComplete="name"
                  maxLength={60}
                  minLength={2}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Как к тебе обращаться"
                  required
                  value={name}
                />
              </label>
            )}

            <label className="form-group">
              <span className="form-label">
                Email <span>*</span>
              </span>
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="form-group">
              <span className="form-label">
                Пароль <span>*</span>
              </span>
              <input
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Минимум 8 символов"
                required
                type="password"
                value={password}
              />
            </label>

            {isRegister && (
              <label className="form-group">
                <span className="form-label">
                  Повтори пароль <span>*</span>
                </span>
                <input
                  autoComplete="new-password"
                  minLength={8}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Ещё раз введи пароль"
                  required
                  type="password"
                  value={confirmPassword}
                />
              </label>
            )}

            <Button
              className="form-submit-button auth-submit"
              disabled={isSubmitting}
              type="submit"
              variant="contained"
            >
              {isSubmitting
                ? "Подожди..."
                : isRegister
                  ? "Зарегистрироваться"
                  : "Войти"}
            </Button>
          </form>

          <p className="auth-switch">
            {isRegister ? "Уже есть аккаунт?" : "Впервые в Foundly?"}{" "}
            <Link href={authSwitchHref}>
              {isRegister ? "Войти" : "Зарегистрироваться"}
            </Link>
          </p>
          {!isRegister && (
            <p className="auth-switch">
              <Link href="/forgot-password">Забыли пароль?</Link>
            </p>
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
