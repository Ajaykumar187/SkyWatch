"use client";

import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import { useLocation } from "@/context/LocationContext";
import { audioAlertEngine } from "@/lib/audioAlert";
import type { AlertPreferences, FavoriteCity, SearchHistoryItem } from "@/lib/types";
import {
  User as UserIcon,
  Lock,
  Mail,
  Eye,
  EyeOff,
  MapPin,
  Trash2,
  ArrowRight,
  Shield,
  Bell,
  Check,
  Sparkles,
  Sliders,
  RefreshCw,
  LogOut,
  Sun,
  Compass,
  Wind,
  Search,
  ExternalLink,
} from "lucide-react";

interface User {
  id?: string;
  username: string;
  email: string;
}

const AVATAR_PALETTES = [
  { id: "ocean", name: "Ocean Blue", bg: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)", text: "#ffffff" },
  { id: "aurora", name: "Aurora Green", bg: "linear-gradient(135deg, #059669 0%, #10b981 100%)", text: "#ffffff" },
  { id: "sunset", name: "Sunset Coral", bg: "linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)", text: "#ffffff" },
  { id: "cosmic", name: "Cosmic Purple", bg: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)", text: "#ffffff" },
  { id: "cyber", name: "Cyber Amber", bg: "linear-gradient(135deg, #d97706 0%, #eab308 100%)", text: "#ffffff" },
];

const SUGGESTED_CITIES = [
  { name: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503 },
  { name: "New York", country: "United States", lat: 40.7128, lon: -74.006 },
  { name: "London", country: "United Kingdom", lat: 51.5074, lon: -0.1278 },
  { name: "Dubai", country: "United Arab Emirates", lat: 25.2048, lon: 55.2708 },
  { name: "Paris", country: "France", lat: 48.8566, lon: 2.3522 },
  { name: "Sydney", country: "Australia", lat: -33.8688, lon: 151.2093 },
];

export default function AccountPage() {
  const router = useRouter();
  const { location, setLocation } = useLocation();

  const [user, setUser] = useState<User | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [signupForm, setSignupForm] = useState({ username: "", email: "", password: "" });

  const [activeAccountTab, setActiveAccountTab] = useState<"locations" | "preferences" | "alerts" | "history" | "security">("locations");

  const [favorites, setFavorites] = useState<FavoriteCity[]>([]);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [preferences, setPreferences] = useState<AlertPreferences | null>(null);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [avatarTheme, setAvatarTheme] = useState<string>("ocean");

  const [tempUnit, setTempUnit] = useState<"C" | "F">("C");
  const [windUnit, setWindUnit] = useState<"kmh" | "mph" | "ms" | "knots">("kmh");
  const [pressureUnit, setPressureUnit] = useState<"hpa" | "inhg" | "mmhg">("hpa");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.6);

  const passwordStrength = useMemo(() => {
    const pw = signupForm.password;
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 6) score += 1;
    if (pw.length >= 10) score += 1;
    if (/[A-Z]/.test(pw)) score += 1;
    if (/[0-9]/.test(pw)) score += 1;
    if (/[^A-Za-z0-9]/.test(pw)) score += 1;
    return score;
  }, [signupForm.password]);

  const loadUserData = () => {
    axios.get("/api/favorites").then((res) => setFavorites(res.data.favorites || [])).catch(() => {});
    axios.get("/api/search-history").then((res) => setHistory(res.data.history || [])).catch(() => {});
    axios
      .get("/api/preferences")
      .then((res) => {
        if (res.data.preferences) {
          setPreferences(res.data.preferences);
        } else {
          setPreferences({
            heavyRain: true,
            thunderstorm: true,
            heatwave: true,
            flood: false,
            emailEnabled: false,
            email: "",
            pushEnabled: true,
          });
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("skywatch_avatar_theme");
      if (savedTheme) setAvatarTheme(savedTheme);

      const savedTemp = localStorage.getItem("skywatch_temp_unit");
      if (savedTemp === "F" || savedTemp === "C") setTempUnit(savedTemp);

      const savedWind = localStorage.getItem("skywatch_wind_unit");
      if (savedWind) setWindUnit(savedWind as typeof windUnit);

      const savedPress = localStorage.getItem("skywatch_press_unit");
      if (savedPress) setPressureUnit(savedPress as typeof pressureUnit);

      const savedSound = localStorage.getItem("skywatch_alert_sound");
      if (savedSound !== null) setSoundEnabled(savedSound === "true");

      const savedVol = localStorage.getItem("skywatch_alert_volume");
      if (savedVol !== null) setSoundVolume(Number(savedVol));
    }

    axios
      .get("/api/auth/me")
      .then((res) => {
        setUser(res.data.user);
        if (res.data.user) loadUserData();
      })
      .finally(() => setCheckedAuth(true));
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      setAuthError("Please provide both username and password.");
      return;
    }
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const res = await axios.post("/api/auth/login", loginForm);
      setUser(res.data);
      loadUserData();
      showToast(`Welcome back, ${res.data.username}!`);
    } catch (err) {
      setAuthError(axios.isAxiosError(err) ? err.response?.data?.error : "Login failed.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!signupForm.username.trim() || !signupForm.email.trim() || !signupForm.password.trim()) {
      setAuthError("All fields are required.");
      return;
    }
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const res = await axios.post("/api/auth/register", signupForm);
      setUser(res.data);
      loadUserData();
      showToast(`Account created successfully! Welcome, ${res.data.username}!`);
    } catch (err) {
      setAuthError(axios.isAxiosError(err) ? err.response?.data?.error : "Sign up failed.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const res = await axios.post("/api/auth/login", {
        username: "demo_analyst",
        password: "Password123!",
      });
      setUser(res.data);
      loadUserData();
      showToast("Logged in as Demo Weather Analyst!");
    } catch {
      try {
        const regRes = await axios.post("/api/auth/register", {
          username: "demo_analyst",
          email: "analyst@skywatch.meteo",
          password: "Password123!",
        });
        setUser(regRes.data);
        loadUserData();
        showToast("Demo Weather Analyst account provisioned and active!");
      } catch (err) {
        setAuthError(axios.isAxiosError(err) ? err.response?.data?.error : "Demo login failed.");
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await axios.post("/api/auth/logout");
    setUser(null);
    setFavorites([]);
    setHistory([]);
    setPreferences(null);
    showToast("Signed out successfully.");
  };

  const addFavoriteCity = async (fav: { name: string; lat: number; lon: number; country?: string }) => {
    try {
      const res = await axios.post("/api/favorites", fav);
      setFavorites(res.data.favorites);
      showToast(`Added "${fav.name}" to saved favorites!`);
    } catch {
      showToast("Could not save city.");
    }
  };

  const removeFavorite = async (name: string) => {
    try {
      const res = await axios.delete("/api/favorites", { params: { name } });
      setFavorites(res.data.favorites);
      showToast(`Removed "${name}" from saved favorites.`);
    } catch {
      showToast("Failed to remove favorite.");
    }
  };

  const handleSavePreferences = async () => {
    if (!preferences) return;
    try {
      const res = await axios.post("/api/preferences", preferences);
      setPreferences(res.data.preferences);

      if (typeof window !== "undefined") {
        localStorage.setItem("skywatch_temp_unit", tempUnit);
        localStorage.setItem("skywatch_wind_unit", windUnit);
        localStorage.setItem("skywatch_press_unit", pressureUnit);
        localStorage.setItem("skywatch_alert_sound", String(soundEnabled));
        localStorage.setItem("skywatch_alert_volume", String(soundVolume));
        localStorage.setItem("skywatch_avatar_theme", avatarTheme);
      }

      setPrefsSaved(true);
      showToast("Account & weather preferences saved successfully!");
      setTimeout(() => setPrefsSaved(false), 2500);
    } catch {
      showToast("Failed to sync preferences.");
    }
  };

  const clearSearchHistory = async () => {
    try {
      await axios.delete("/api/search-history");
      setHistory([]);
      showToast("Search history cleared.");
    } catch {
      showToast("Failed to clear search history.");
    }
  };

  const activePalette = AVATAR_PALETTES.find((p) => p.id === avatarTheme) || AVATAR_PALETTES[0];

  if (!checkedAuth) {
    return (
      <div style={{ padding: "80px 0", textAlign: "center" }} className="text-muted">
        <RefreshCw className="animate-spin" style={{ margin: "0 auto 12px", width: 28, height: 28 }} />
        Checking user session...
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        {toastMsg && (
          <div
            style={{
              position: "fixed",
              top: 80,
              right: 24,
              zIndex: 9999,
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid #3b82f6",
              color: "#ffffff",
              padding: "10px 18px",
              borderRadius: "12px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              fontSize: "0.88rem",
              fontWeight: 600,
            }}
          >
            {toastMsg}
          </div>
        )}

        <div className="flex justify-between items-center" style={{ flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div>
            <h1 className="section-title" style={{ marginBottom: 4 }}>
              Meteorological Account &amp; Profile Hub
            </h1>
            <p className="section-sub" style={{ margin: 0 }}>
              Synchronize your personal weather dashboard, favorite cities, threshold alerts, and custom layouts across all devices.
            </p>
          </div>
        </div>

        <div className="grid grid-2" style={{ alignItems: "stretch", gap: 24 }}>
          <Card style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div className="flex items-center gap-8" style={{ marginBottom: 12 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 36,
                    height: 36,
                    borderRadius: "10px",
                    background: "rgba(37, 99, 235, 0.2)",
                    color: "var(--navy)",
                  }}
                >
                  <Sparkles size={20} />
                </span>
                <h3 style={{ margin: 0, fontSize: "1.15rem" }}>Why Create an Account?</h3>
              </div>
              <p className="text-muted" style={{ fontSize: "0.88rem", lineHeight: 1.6, marginBottom: 20 }}>
                Unlock high-resolution cloud synchronization, automated early-warning alerts, and bespoke weather instrumentation.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="flex items-start gap-12">
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "rgba(34, 197, 94, 0.15)",
                      color: "#22c55e",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <MapPin size={16} />
                  </div>
                  <div>
                    <strong style={{ fontSize: "0.9rem" }}>Cloud Favorite Locations</strong>
                    <p className="text-muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>
                      Pin your hometown, travel destinations, and weather monitoring stations.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-12">
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "rgba(249, 115, 22, 0.15)",
                      color: "#f97316",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Bell size={16} />
                  </div>
                  <div>
                    <strong style={{ fontSize: "0.9rem" }}>Custom Alert Rule Thresholds</strong>
                    <p className="text-muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>
                      Get notified when temperatures cross 35°C, winds exceed 40 km/h, or storms approach.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-12">
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "#3b82f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Sliders size={16} />
                  </div>
                  <div>
                    <strong style={{ fontSize: "0.9rem" }}>Personalized Layouts &amp; Units</strong>
                    <p className="text-muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>
                      Reorder cards, choose preferred measurement units (°C/°F, km/h, hPa), and customize themes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 24,
                padding: "16px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
              }}
            >
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#38bdf8", marginBottom: 6 }}>
                ⚡ Quick Evaluation
              </div>
              <p className="text-muted" style={{ margin: "0 0 12px", fontSize: "0.8rem" }}>
                Test all premium features instantly without registration using our sandbox analyst profile.
              </p>
              <button
                className="btn btn-accent"
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                onClick={handleDemoLogin}
                disabled={authSubmitting}
              >
                <span>⚡ Continue as Demo Analyst</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </Card>

          <Card>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                background: "rgba(15, 23, 42, 0.6)",
                padding: 4,
                borderRadius: 14,
                marginBottom: 20,
                border: "1px solid var(--card-border)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setTab("login");
                  setAuthError(null);
                }}
                style={{
                  padding: "9px 0",
                  borderRadius: 10,
                  border: "none",
                  background: tab === "login" ? "var(--navy)" : "transparent",
                  color: tab === "login" ? "#ffffff" : "var(--text-muted)",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <UserIcon size={16} />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("signup");
                  setAuthError(null);
                }}
                style={{
                  padding: "9px 0",
                  borderRadius: 10,
                  border: "none",
                  background: tab === "signup" ? "var(--navy)" : "transparent",
                  color: tab === "signup" ? "#ffffff" : "var(--text-muted)",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Sparkles size={16} />
                <span>Create Account</span>
              </button>
            </div>

            {authError && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "rgba(220, 38, 38, 0.15)",
                  border: "1px solid rgba(220, 38, 38, 0.4)",
                  borderRadius: 8,
                  color: "#f87171",
                  fontSize: "0.84rem",
                  marginBottom: 16,
                }}
              >
                ⚠️ {authError}
              </div>
            )}

            {tab === "login" ? (
              <form onSubmit={handleLogin}>
                <div className="field" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <UserIcon size={14} className="text-muted" />
                    <span>Username</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your username"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    required
                  />
                </div>

                <div className="field" style={{ marginBottom: 18 }}>
                  <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
                      <Lock size={14} className="text-muted" />
                      <span>Password</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      <span>{showPassword ? "Hide" : "Show"}</span>
                    </button>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn"
                  style={{ width: "100%", padding: "0.75rem", fontSize: "0.95rem", fontWeight: 700 }}
                  disabled={authSubmitting}
                >
                  {authSubmitting ? "Authenticating..." : "Sign In to Account"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup}>
                <div className="field" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <UserIcon size={14} className="text-muted" />
                    <span>Desired Username</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. storm_chaser, meteor_88"
                    value={signupForm.username}
                    onChange={(e) => setSignupForm({ ...signupForm, username: e.target.value })}
                    required
                  />
                </div>

                <div className="field" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <Mail size={14} className="text-muted" />
                    <span>Email Address</span>
                  </label>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={signupForm.email}
                    onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="field" style={{ marginBottom: 14 }}>
                  <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
                      <Lock size={14} className="text-muted" />
                      <span>Password</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      <span>{showPassword ? "Hide" : "Show"}</span>
                    </button>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimum 6 characters"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                    required
                  />
                  {signupForm.password && (
                    <div style={{ marginTop: 8 }}>
                      <div
                        style={{
                          height: 4,
                          borderRadius: 2,
                          background: "rgba(255,255,255,0.1)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${(passwordStrength / 5) * 100}%`,
                            background:
                              passwordStrength <= 2 ? "#ef4444" : passwordStrength <= 3 ? "#f59e0b" : "#10b981",
                            transition: "all 0.3s ease",
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-center" style={{ fontSize: "0.72rem", marginTop: 4 }}>
                        <span className="text-muted">Password Strength</span>
                        <span
                          style={{
                            fontWeight: 700,
                            color:
                              passwordStrength <= 2 ? "#ef4444" : passwordStrength <= 3 ? "#f59e0b" : "#10b981",
                          }}
                        >
                          {passwordStrength <= 2 ? "Weak" : passwordStrength <= 3 ? "Good" : "Strong"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-accent"
                  style={{ width: "100%", padding: "0.75rem", fontSize: "0.95rem", fontWeight: 700 }}
                  disabled={authSubmitting}
                >
                  {authSubmitting ? "Creating Account..." : "Create Free Account"}
                </button>
              </form>
            )}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            top: 80,
            right: 24,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.95)",
            border: "1px solid #3b82f6",
            color: "#ffffff",
            padding: "10px 18px",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            fontSize: "0.88rem",
            fontWeight: 600,
          }}
        >
          {toastMsg}
        </div>
      )}

      <Card
        style={{
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.85) 100%)",
          borderColor: "rgba(59, 130, 246, 0.3)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div className="flex justify-between items-center" style={{ flexWrap: "wrap", gap: 16 }}>
          <div className="flex items-center gap-16">
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: activePalette.bg,
                color: activePalette.text,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.7rem",
                fontWeight: 800,
                boxShadow: "0 0 20px rgba(37, 99, 235, 0.4)",
                border: "3px solid rgba(255, 255, 255, 0.2)",
                flexShrink: 0,
              }}
            >
              {user.username.slice(0, 2).toUpperCase()}
            </div>

            <div>
              <div className="flex items-center gap-10">
                <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>{user.username}</h1>
                <Badge kind="info">Verified Meteorologist</Badge>
              </div>
              <p className="text-muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                {user.email || "No email on record"}
              </p>

              <div className="flex items-center gap-6" style={{ marginTop: 8 }}>
                <span className="text-muted" style={{ fontSize: "0.72rem" }}>Theme:</span>
                {AVATAR_PALETTES.map((pal) => (
                  <button
                    key={pal.id}
                    title={pal.name}
                    onClick={() => {
                      setAvatarTheme(pal.id);
                      localStorage.setItem("skywatch_avatar_theme", pal.id);
                    }}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: pal.bg,
                      border: avatarTheme === pal.id ? "2px solid #ffffff" : "1px solid rgba(255,255,255,0.2)",
                      cursor: "pointer",
                      padding: 0,
                      transform: avatarTheme === pal.id ? "scale(1.25)" : "scale(1)",
                      transition: "transform 0.15s ease",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-10">
            <button
              className="btn btn-outline"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              onClick={() => router.push("/")}
            >
              <Sun size={16} />
              <span>Go to Dashboard</span>
            </button>
            <button
              className="btn btn-danger"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.6rem 1.1rem" }}
              onClick={handleLogout}
            >
              <LogOut size={16} />
              <span>Log out</span>
            </button>
          </div>
        </div>

        <div
          className="grid grid-4"
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--card-border)",
            gap: 12,
          }}
        >
          <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "10px 14px", borderRadius: 10 }}>
            <div className="text-muted" style={{ fontSize: "0.74rem" }}>Saved Favorites</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#38bdf8" }}>{favorites.length} Cities</div>
          </div>
          <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "10px 14px", borderRadius: 10 }}>
            <div className="text-muted" style={{ fontSize: "0.74rem" }}>Search History</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#10b981" }}>{history.length} Queries</div>
          </div>
          <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "10px 14px", borderRadius: 10 }}>
            <div className="text-muted" style={{ fontSize: "0.74rem" }}>Active Alert Rules</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#f59e0b" }}>
              {preferences ? (preferences.heavyRain ? 1 : 0) + (preferences.thunderstorm ? 1 : 0) + (preferences.heatwave ? 1 : 0) : 0} Monitored
            </div>
          </div>
          <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "10px 14px", borderRadius: 10 }}>
            <div className="text-muted" style={{ fontSize: "0.74rem" }}>Cloud Sync</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#a855f7" }}>Online 🟢</div>
          </div>
        </div>
      </Card>

      <div
        className="map-layers mt"
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          padding: 6,
          background: "rgba(15, 23, 42, 0.5)",
          borderRadius: 14,
          border: "1px solid var(--card-border)",
        }}
      >
        <button
          className={activeAccountTab === "locations" ? "tab active" : "tab"}
          onClick={() => setActiveAccountTab("locations")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <MapPin size={15} />
          <span>Saved Cities ({favorites.length})</span>
        </button>
        <button
          className={activeAccountTab === "preferences" ? "tab active" : "tab"}
          onClick={() => setActiveAccountTab("preferences")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Sliders size={15} />
          <span>Units &amp; Preferences</span>
        </button>
        <button
          className={activeAccountTab === "alerts" ? "tab active" : "tab"}
          onClick={() => setActiveAccountTab("alerts")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Bell size={15} />
          <span>Alert Subscriptions</span>
        </button>
        <button
          className={activeAccountTab === "history" ? "tab active" : "tab"}
          onClick={() => setActiveAccountTab("history")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Search size={15} />
          <span>Search History ({history.length})</span>
        </button>
        <button
          className={activeAccountTab === "security" ? "tab active" : "tab"}
          onClick={() => setActiveAccountTab("security")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Shield size={15} />
          <span>Security &amp; Storage</span>
        </button>
      </div>

      {activeAccountTab === "locations" && (
        <div className="mt">
          <Card title="Saved Favorite Cities">
            <div className="flex justify-between items-center" style={{ flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              <p className="text-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                Quickly switch your dashboard center or navigate to high-definition interactive weather maps.
              </p>
              {location && (
                <button
                  className="btn"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.84rem" }}
                  onClick={() =>
                    addFavoriteCity({
                      name: location.name,
                      lat: location.lat,
                      lon: location.lon,
                      country: location.country,
                    })
                  }
                >
                  <MapPin size={15} />
                  <span>+ Save Current City ({location.name})</span>
                </button>
              )}
            </div>

            {favorites.length === 0 ? (
              <div
                style={{
                  padding: "36px 16px",
                  textAlign: "center",
                  background: "rgba(255, 255, 255, 0.02)",
                  borderRadius: 12,
                  border: "1px dashed var(--card-border)",
                }}
              >
                <MapPin size={32} className="text-muted" style={{ margin: "0 auto 8px" }} />
                <h4 style={{ margin: "0 0 6px" }}>No favorite cities saved yet</h4>
                <p className="text-muted" style={{ fontSize: "0.82rem", margin: "0 auto 16px", maxWidth: 380 }}>
                  Add your current city from above or pick from popular global meteorological hubs below.
                </p>
              </div>
            ) : (
              <div className="grid grid-3" style={{ gap: 12 }}>
                {favorites.map((fav) => {
                  const isCurrent = location?.name === fav.name;
                  return (
                    <div
                      key={fav.name}
                      style={{
                        padding: "14px 16px",
                        background: isCurrent ? "rgba(37, 99, 235, 0.12)" : "rgba(255, 255, 255, 0.04)",
                        border: isCurrent ? "1.5px solid #3b82f6" : "1px solid var(--card-border)",
                        borderRadius: "12px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "1rem" }}>{fav.name}</div>
                            <div className="text-muted" style={{ fontSize: "0.78rem" }}>
                              {fav.country || "Global Station"}
                            </div>
                          </div>
                          {isCurrent && <Badge kind="success">Active</Badge>}
                        </div>
                        <div className="text-muted" style={{ fontSize: "0.72rem", marginTop: 6 }}>
                          Coordinates: {fav.lat.toFixed(2)}°, {fav.lon.toFixed(2)}°
                        </div>
                      </div>

                      <div className="flex items-center gap-8" style={{ borderTop: "1px solid var(--card-border)", paddingTop: 10 }}>
                        <button
                          className="btn btn-outline"
                          style={{ flex: 1, padding: "5px 10px", fontSize: "0.76rem" }}
                          onClick={() => {
                            setLocation({
                              name: fav.name,
                              lat: fav.lat,
                              lon: fav.lon,
                              country: fav.country || "",
                            });
                            showToast(`Dashboard centered to ${fav.name}`);
                          }}
                        >
                          Set Active
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ padding: "5px 10px", fontSize: "0.76rem" }}
                          title="View on Map"
                          onClick={() => {
                            setLocation({
                              name: fav.name,
                              lat: fav.lat,
                              lon: fav.lon,
                              country: fav.country || "",
                            });
                            router.push("/map");
                          }}
                        >
                          <ExternalLink size={13} />
                        </button>
                        <button
                          className="icon-btn"
                          style={{ color: "var(--danger)", padding: 6 }}
                          title="Delete favorite"
                          onClick={() => removeFavorite(fav.name)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--card-border)" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: 10 }}>
                💡 Suggested Global Met Hubs (1-Click Add):
              </div>
              <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                {SUGGESTED_CITIES.map((city) => {
                  const alreadySaved = favorites.some((f) => f.name === city.name);
                  return (
                    <button
                      key={city.name}
                      disabled={alreadySaved}
                      onClick={() => addFavoriteCity(city)}
                      className="btn btn-outline"
                      style={{
                        padding: "5px 12px",
                        fontSize: "0.78rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        opacity: alreadySaved ? 0.5 : 1,
                      }}
                    >
                      <span>{alreadySaved ? "✓" : "+"}</span>
                      <span>{city.name} ({city.country})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeAccountTab === "preferences" && (
        <div className="mt">
          <Card title="Measurement Units &amp; Display Configurations">
            <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: 20 }}>
              Tailor how meteorological observations, charts, and maps are presented throughout your SkyWatch experience.
            </p>

            <div className="grid grid-3" style={{ gap: 16 }}>
              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 16, borderRadius: 12, border: "1px solid var(--card-border)" }}>
                <div className="flex items-center gap-6" style={{ marginBottom: 10 }}>
                  <Sun size={16} className="text-muted" />
                  <strong style={{ fontSize: "0.9rem" }}>Temperature Unit</strong>
                </div>
                <div className="flex gap-8">
                  <button
                    className={`tab ${tempUnit === "C" ? "active" : ""}`}
                    style={{ flex: 1, padding: "8px 0", fontSize: "0.82rem" }}
                    onClick={() => setTempUnit("C")}
                  >
                    Celsius (°C)
                  </button>
                  <button
                    className={`tab ${tempUnit === "F" ? "active" : ""}`}
                    style={{ flex: 1, padding: "8px 0", fontSize: "0.82rem" }}
                    onClick={() => setTempUnit("F")}
                  >
                    Fahrenheit (°F)
                  </button>
                </div>
              </div>

              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 16, borderRadius: 12, border: "1px solid var(--card-border)" }}>
                <div className="flex items-center gap-6" style={{ marginBottom: 10 }}>
                  <Wind size={16} className="text-muted" />
                  <strong style={{ fontSize: "0.9rem" }}>Wind Speed Unit</strong>
                </div>
                <div className="flex gap-6" style={{ flexWrap: "wrap" }}>
                  {(["kmh", "mph", "ms", "knots"] as const).map((unit) => (
                    <button
                      key={unit}
                      className={`tab ${windUnit === unit ? "active" : ""}`}
                      style={{ flex: 1, minWidth: 60, padding: "8px 4px", fontSize: "0.78rem" }}
                      onClick={() => setWindUnit(unit)}
                    >
                      {unit === "kmh" ? "km/h" : unit === "mph" ? "mph" : unit === "ms" ? "m/s" : "Knots"}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 16, borderRadius: 12, border: "1px solid var(--card-border)" }}>
                <div className="flex items-center gap-6" style={{ marginBottom: 10 }}>
                  <Compass size={16} className="text-muted" />
                  <strong style={{ fontSize: "0.9rem" }}>Barometric Pressure</strong>
                </div>
                <div className="flex gap-6">
                  {(["hpa", "inhg", "mmhg"] as const).map((unit) => (
                    <button
                      key={unit}
                      className={`tab ${pressureUnit === unit ? "active" : ""}`}
                      style={{ flex: 1, padding: "8px 4px", fontSize: "0.78rem" }}
                      onClick={() => setPressureUnit(unit)}
                    >
                      {unit.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                padding: 16,
                background: "rgba(255, 255, 255, 0.03)",
                borderRadius: 12,
                border: "1px solid var(--card-border)",
              }}
            >
              <div className="flex justify-between items-center" style={{ flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
                <div>
                  <strong style={{ fontSize: "0.9rem" }}>Synthesized Audio Chimes &amp; Sirens</strong>
                  <p className="text-muted" style={{ margin: "2px 0 0", fontSize: "0.78rem" }}>
                    Audible Web Audio API notifications when dangerous meteorological anomalies are detected.
                  </p>
                </div>
                <div className="flex items-center gap-12">
                  <button
                    className="btn btn-outline"
                    style={{ fontSize: "0.76rem", padding: "4px 10px" }}
                    onClick={() => audioAlertEngine.playWarningChime(soundVolume)}
                  >
                    🔊 Test Chime
                  </button>
                  <label className="flex items-center gap-6" style={{ cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(e) => setSoundEnabled(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: "#3b82f6" }}
                    />
                    <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Enabled</span>
                  </label>
                </div>
              </div>

              {soundEnabled && (
                <div>
                  <div className="flex justify-between items-center" style={{ fontSize: "0.78rem", marginBottom: 4 }}>
                    <span className="text-muted">Volume Level</span>
                    <span>{Math.round(soundVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={soundVolume}
                    onChange={(e) => setSoundVolume(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#3b82f6" }}
                  />
                </div>
              )}
            </div>

            <div className="mt flex items-center gap-10">
              <button
                className="btn btn-accent"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={handleSavePreferences}
              >
                <Check size={16} />
                <span>{prefsSaved ? "Saved Successfully!" : "Save All Preferences"}</span>
              </button>
            </div>
          </Card>
        </div>
      )}

      {activeAccountTab === "alerts" && preferences && (
        <div className="mt">
          <Card title="Automated Severity Subscriptions">
            <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: 16 }}>
              Select which meteorological condition classes should trigger automated push notifications, audio sirens, and webhooks.
            </p>

            <div className="grid grid-2" style={{ gap: 14 }}>
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--card-border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>🌧️ Heavy Rain &amp; Flooding</div>
                  <div className="text-muted" style={{ fontSize: "0.78rem" }}>
                    Trigger when precipitation exceeds 25mm in 24 hours.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.heavyRain}
                  onChange={(e) => setPreferences({ ...preferences, heavyRain: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: "#3b82f6" }}
                />
              </div>

              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--card-border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>⚡ Severe Thunderstorms</div>
                  <div className="text-muted" style={{ fontSize: "0.78rem" }}>
                    Trigger on lightning, convective storms, or hail.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.thunderstorm}
                  onChange={(e) => setPreferences({ ...preferences, thunderstorm: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: "#3b82f6" }}
                />
              </div>

              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--card-border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>🔥 Extreme Heatwave</div>
                  <div className="text-muted" style={{ fontSize: "0.78rem" }}>
                    Trigger when temperatures surge past 38°C (100°F).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.heatwave}
                  onChange={(e) => setPreferences({ ...preferences, heatwave: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: "#3b82f6" }}
                />
              </div>

              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--card-border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>🌊 Coastal Surge &amp; Flash Flood</div>
                  <div className="text-muted" style={{ fontSize: "0.78rem" }}>
                    Trigger when sudden barometric drops and heavy run-off coincide.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.flood}
                  onChange={(e) => setPreferences({ ...preferences, flood: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: "#3b82f6" }}
                />
              </div>
            </div>

            <button className="btn mt" onClick={handleSavePreferences}>
              {prefsSaved ? "Saved ✓" : "Save Alert Subscriptions"}
            </button>
          </Card>
        </div>
      )}

      {activeAccountTab === "history" && (
        <div className="mt">
          <Card title="Search Activity &amp; Query Audit">
            <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
              <p className="text-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                Recent atmospheric locations queried from the dashboard and global search bar.
              </p>
              {history.length > 0 && (
                <button
                  className="btn btn-outline"
                  style={{ fontSize: "0.76rem", padding: "4px 10px", color: "var(--danger)" }}
                  onClick={clearSearchHistory}
                >
                  Clear History
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0" }} className="text-muted">
                <Search size={28} style={{ margin: "0 auto 8px" }} />
                <p style={{ margin: 0, fontSize: "0.85rem" }}>No search history recorded yet.</p>
              </div>
            ) : (
              <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {history.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--card-border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div className="flex items-center gap-8">
                      <Search size={14} className="text-muted" />
                      <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{h.query}</span>
                    </div>
                    <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                      {new Date(h.at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeAccountTab === "security" && (
        <div className="mt">
          <Card title="Account Security &amp; Storage Architecture">
            <div className="grid grid-2" style={{ gap: 16 }}>
              <div>
                <h4 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Session Lifecycle</h4>
                <p className="text-muted" style={{ fontSize: "0.82rem", lineHeight: 1.5, margin: "0 0 12px" }}>
                  Your session is cryptographically signed using HTTP-only cookies with Lax SameSite protection, expiring automatically after 30 days of inactivity.
                </p>
                <div style={{ fontSize: "0.8rem" }}>
                  <div className="flex justify-between" style={{ padding: "6px 0", borderBottom: "1px solid var(--card-border)" }}>
                    <span className="text-muted">Account Identity:</span>
                    <strong>{user.username}</strong>
                  </div>
                  <div className="flex justify-between" style={{ padding: "6px 0", borderBottom: "1px solid var(--card-border)" }}>
                    <span className="text-muted">Database Tier:</span>
                    <span style={{ color: "#10b981", fontWeight: 700 }}>Dual-Engine (Postgres + Storage Fallback)</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Terminate Session</h4>
                <p className="text-muted" style={{ fontSize: "0.82rem", lineHeight: 1.5, margin: "0 0 16px" }}>
                  Signing out clears your authentication token from this browser while preserving all cloud-synced favorites and alert rules.
                </p>
                <button
                  className="btn btn-danger"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  <span>Log Out of Session</span>
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
