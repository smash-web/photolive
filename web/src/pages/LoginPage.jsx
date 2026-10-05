import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fn = mode === "login" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
      const { data, error } = await fn({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      if (mode === "signup" && !data.session) {
        setError("Аккаунт создан. Проверьте почту и подтвердите email, затем войдите.");
        return;
      }
      window.location.href = "/gallery";
    } catch (err) {
      setError("Ошибка соединения с сервером авторизации: " + (err?.message || String(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ maxWidth: 320, margin: "60px auto" }}>
      <h2>{mode === "login" ? "Вход" : "Регистрация"}</h2>
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
      <input placeholder="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button type="submit" disabled={busy} style={{ width: "100%" }}>
        {busy ? "Подождите..." : mode === "login" ? "Войти" : "Создать аккаунт"}
      </button>
      <p style={{ marginTop: 12, fontSize: 13, cursor: "pointer" }} onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
      </p>
    </form>
  );
}
