import { useEffect, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { LoginScreen } from "./components/LoginScreen";
import { hasLiveBackend, loadSession } from "./lib/api";

type Gate = "checking" | "login" | "ready";

export default function App() {
  // Mock-only mode (no backend) has nothing to log in to.
  const [gate, setGate] = useState<Gate>(hasLiveBackend() ? "checking" : "ready");

  useEffect(() => {
    if (!hasLiveBackend()) return;
    // An unreachable server is not a reason to show the login page — the
    // dashboard's own error banner explains that case better.
    loadSession().then((s) => setGate(s.status === "unauthenticated" ? "login" : "ready"));
  }, []);

  if (gate === "checking") return null;
  // A full reload after logging in starts every data fetch fresh with the
  // new session, instead of reusing anything requested while logged out.
  if (gate === "login") return <LoginScreen onLoggedIn={() => window.location.reload()} />;
  return <Dashboard />;
}
