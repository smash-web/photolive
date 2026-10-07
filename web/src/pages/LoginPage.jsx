import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = "/gallery";
    });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { data, error } =
        mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });

      if (error) {
        setError(error.message);
        return;
      }
      if (mode === "signup" && !data.session) {
        setNotice("Аккаунт создан. Проверьте почту, подтвердите email и затем войдите.");
        setMode("login");
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
    <div className="auth-shell">
      <div className="auth-card">
        <h1>{mode === "login" ? "С возвращением" : "Создайте аккаунт"}</h1>
        <p className="auth-subtitle">
          {mode === "login"
            ? "Войдите, чтобы увидеть свои живые фотографии."
            : "Это бесплатно и займёт меньше минуты."}
        </p>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {notice && <div className="alert alert-info">{notice}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Подождите…" : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>

        <p className="auth-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setNotice(null); }}>
          {mode === "login" ? (
            <>Нет аккаунта? <span>Зарегистрироваться</span></>
          ) : (
            <>Уже есть аккаунт? <span>Войти</span></>
          )}
        </p>
      </div>
    </div>
  );
}
