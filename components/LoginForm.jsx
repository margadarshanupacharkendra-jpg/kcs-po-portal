"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed.");
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong — try again.");
      setLoading(false);
    }
  }

  return (
    <div style={wrap}>
      <style>{CSS}</style>
      <form onSubmit={submit} className="login-card">
        <div className="login-mark"><Building2 size={20} strokeWidth={2.2} /></div>
        <div className="login-title">Kshamadevi Construction</div>
        <div className="login-sub">Purchase Order Portal</div>
        <label className="login-field">
          <span>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <div className="login-error">{error}</div>}
        <button className="login-btn" disabled={loading || !username || !password}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

const wrap = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#E9E4D8",
  backgroundImage:
    "linear-gradient(#D3CBB8 1px, transparent 1px), linear-gradient(90deg, #D3CBB8 1px, transparent 1px)",
  backgroundSize: "32px 32px",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
.login-card { width: 320px; background: #F6F3EA; border: 1px solid #D3CBB8; border-radius: 6px; padding: 28px;
  font-family: 'IBM Plex Sans', sans-serif; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.08); }
.login-mark { width: 36px; height: 36px; border: 2px solid #2B4C6F; color: #2B4C6F; display: flex; align-items: center; justify-content: center; }
.login-title { font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 16px; color: #24211B; }
.login-sub { font-size: 12px; color: #6B6559; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .04em; }
.login-field { display: flex; flex-direction: column; gap: 5px; font-size: 11px; color: #6B6559; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
.login-field input { border: 1px solid #D3CBB8; border-radius: 3px; padding: 9px 10px; font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: #24211B; outline: none; }
.login-field input:focus { border-color: #2B4C6F; }
.login-error { color: #A13D2B; font-size: 12px; }
.login-btn { margin-top: 6px; background: #2B4C6F; color: #fff; border: none; border-radius: 3px; padding: 10px; font-weight: 600; font-size: 13px; cursor: pointer; font-family: 'IBM Plex Sans', sans-serif; }
.login-btn:disabled { opacity: .5; cursor: not-allowed; }
`;
