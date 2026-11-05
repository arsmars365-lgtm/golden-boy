"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import VerifiedBadge from "@/components/verified-badge";
import { getCurrentProfile, isValidUsername, type Profile } from "@/lib/profiles";
import { useDemoAuth } from "@/lib/use-demo-auth";
import { getSupabaseClient } from "@/lib/supabase";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isReady } = useDemoAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [faculty, setFaculty] = useState("");
  const [course, setCourse] = useState("");
  const [telegram, setTelegram] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void getCurrentProfile(user.id).then((currentProfile) => {
      if (!active || !currentProfile) return;
      setProfile(currentProfile);
      setUsername(currentProfile.username);
      setFullName(currentProfile.full_name);
      setBio(currentProfile.bio);
      setFaculty(currentProfile.faculty);
      setCourse(currentProfile.course?.toString() ?? "");
      setTelegram(currentProfile.contact_telegram);
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить профиль.");
    });
    return () => { active = false; };
  }, [user]);

  function onAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setError("Выберите JPG, PNG или WebP размером не более 5 МБ.");
      event.target.value = "";
      return;
    }
    setError("");
    setAvatarFile(file);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!user || !profile) return;
    if (!isValidUsername(username)) {
      setError("Никнейм: 3–20 символов, латинские буквы, цифры и _.");
      return;
    }
    setSaving(true);
    const supabase = getSupabaseClient();
    try {
      let avatarUrl = profile.avatar_url;
      if (avatarFile) {
        const path = `${user.id}/avatar-${Date.now()}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (uploadError) throw new Error(`Не удалось загрузить аватар: ${uploadError.message}`);
        avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          username: username.trim(),
          full_name: fullName.trim(),
          bio: bio.trim(),
          faculty: faculty.trim(),
          course: course ? Number(course) : null,
          contact_telegram: telegram.trim().replace(/^@/, ""),
          avatar_url: avatarUrl,
        })
        .eq("id", user.id)
        .select("id,username,full_name,avatar_url,bio,faculty,course,contact_telegram,role,is_verified,is_blocked,created_at")
        .single();
      if (updateError) throw new Error(`Не удалось сохранить профиль: ${updateError.message}`);
      setProfile(data as Profile);
      setAvatarFile(null);
      setMessage("Профиль сохранён.");
      router.replace(`/u/${encodeURIComponent(data.username)}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить профиль.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="foundly-shell container-fluid px-0">
      <SiteHeader />
      <section className="profile-edit-page container">
        {!isReady ? <p>Проверяем аккаунт…</p> : !user ? (
          <div className="profile-empty"><h1>Войдите в аккаунт</h1><p>Чтобы просматривать и редактировать профиль.</p><Button href="/login" variant="contained">Войти</Button></div>
        ) : (
          <>
            <header className="profile-page-heading"><span className="section-kicker">ВАШ АККАУНТ</span><h1>Профиль</h1></header>
            {error && <Alert severity="error">{error}</Alert>}
            {message && <Alert severity="success">{message}</Alert>}
            {profile?.role === "admin" && <Link className="profile-admin-link" href="/admin">Открыть панель администратора →</Link>}
            {profile && (
              <form className="profile-edit-card" onSubmit={saveProfile}>
                <div className="profile-avatar-preview">
                  {profile.avatar_url ? <span role="img" aria-label="Аватар профиля" style={{ backgroundImage: `url("${profile.avatar_url}")` }} /> : <span>{(profile.full_name || profile.username).slice(0, 1).toUpperCase()}</span>}
                </div>
                <p className="profile-username">@{profile.username} {profile.is_verified && <VerifiedBadge />}</p>
                <label className="form-group"><span className="form-label">Фото профиля</span><input accept="image/jpeg,image/png,image/webp" onChange={onAvatarChange} type="file" /></label>
                <label className="form-group"><span className="form-label">Никнейм <span>*</span></span><input maxLength={20} minLength={3} onChange={(event) => setUsername(event.target.value)} pattern="[A-Za-z0-9_]{3,20}" required value={username} /></label>
                <label className="form-group"><span className="form-label">Имя</span><input maxLength={80} onChange={(event) => setFullName(event.target.value)} value={fullName} /></label>
                <label className="form-group"><span className="form-label">О себе</span><textarea maxLength={500} onChange={(event) => setBio(event.target.value)} rows={4} value={bio} /></label>
                <div className="profile-form-columns">
                  <label className="form-group"><span className="form-label">Факультет</span><input maxLength={120} onChange={(event) => setFaculty(event.target.value)} value={faculty} /></label>
                  <label className="form-group"><span className="form-label">Курс</span><input max={8} min={1} onChange={(event) => setCourse(event.target.value)} type="number" value={course} /></label>
                </div>
                <label className="form-group"><span className="form-label">Telegram</span><input maxLength={32} onChange={(event) => setTelegram(event.target.value)} placeholder="@username" value={telegram} /></label>
                <Button disabled={saving} type="submit" variant="contained">{saving ? "Сохраняем…" : "Сохранить профиль"}</Button>
                <p className="profile-edit-note">Роль администратора и подтверждение профиля может менять только администратор.</p>
              </form>
            )}
          </>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
