import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Moon,
  Sun,
  Plus,
  X,
  Check,
  Droplet,
  BookOpen,
  Dumbbell,
  Brain,
  Footprints,
  Code,
  Coffee,
  PenLine,
  ImagePlus,
  Trash2,
  Flame,
  LogOut,
  Loader,
} from "lucide-react";

/* ---------------------------------------------------------------
   Supabase Setup
--------------------------------------------------------------- */

const SUPABASE_URL = "https://oymdanzmnpvfwzoawvua.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95bWRhbnptbnB2Znd6b2F3dnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNzIwMTYsImV4cCI6MjEwNDk0ODAxNn0.mHAQnKCPWzxWqV6d_M2-0hWZC8pJ3IyAjFOorgFxL4o";

// Minimal Supabase client (auth + fetch only, no real-time)
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
  }

  async _request(method, path, body = null) {
    const opts = {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: this.key,
        Authorization: `Bearer ${this.session?.access_token || this.key}`,
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${this.url}/rest/v1${path}`, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return await res.json();
  }

  async _authRequest(method, path, body = null) {
    const res = await fetch(`${this.url}/auth/v1${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: this.key,
      },
      body: body ? JSON.stringify(body) : null,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.message);
    return data;
  }

  async signup(email, password) {
    const data = await this._authRequest("POST", "/signup", { email, password });
    this.session = data.session;
    localStorage.setItem("sb-session", JSON.stringify(data.session));
    return data.user;
  }

  async login(email, password) {
    const data = await this._authRequest("POST", "/token?grant_type=password", {
      email,
      password,
    });
    this.session = data;
    localStorage.setItem("sb-session", JSON.stringify(data));
    return data.user;
  }

  async getSession() {
    const stored = localStorage.getItem("sb-session");
    if (stored) {
      this.session = JSON.parse(stored);
      return this.session;
    }
    return null;
  }

  async logout() {
    localStorage.removeItem("sb-session");
    this.session = null;
  }

  async getUser() {
    if (!this.session?.access_token) return null;
    const res = await fetch(`${this.url}/auth/v1/user`, {
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.session.access_token}`,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  }

  from(table) {
    return new Table(this, table);
  }
}

class Table {
  constructor(client, name) {
    this.client = client;
    this.name = name;
    this.query = null;
  }

  select(cols = "*") {
    this.query = { select: cols, filters: [] };
    return this;
  }

  eq(col, val) {
    if (!this.query) this.query = { select: "*", filters: [] };
    this.query.filters.push({ type: "eq", col, val });
    return this;
  }

  in(col, vals) {
    if (!this.query) this.query = { select: "*", filters: [] };
    this.query.filters.push({ type: "in", col, vals });
    return this;
  }

  async single() {
    const data = await this._exec();
    return data?.length ? data[0] : null;
  }

  async _exec() {
    let path = `/${this.name}?select=${this.query.select}`;
    for (const f of this.query.filters) {
      if (f.type === "eq") path += `&${f.col}=eq.${encodeURIComponent(f.val)}`;
      else if (f.type === "in") path += `&${f.col}=in.(${f.vals.map(encodeURIComponent).join(",")})`;
    }
    return await this.client._request("GET", path);
  }

  async insert(data) {
    return await this.client._request("POST", `/${this.name}`, data);
  }

  async update(data) {
    let path = `/${this.name}`;
    if (this.query?.filters?.length) {
      for (const f of this.query.filters) {
        if (f.type === "eq") path += `?${f.col}=eq.${encodeURIComponent(f.val)}`;
      }
    }
    return await this.client._request("PATCH", path, data);
  }

  async delete() {
    let path = `/${this.name}`;
    if (this.query?.filters?.length) {
      for (const f of this.query.filters) {
        if (f.type === "eq") path += `?${f.col}=eq.${encodeURIComponent(f.val)}`;
      }
    }
    return await this.client._request("DELETE", path);
  }

  async upsert(data) {
    return await this.client._request("POST", `/${this.name}?on_conflict=id`, data);
  }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_KEY);

/* ---------------------------------------------------------------
   Constants & Helpers
--------------------------------------------------------------- */

const ICONS = {
  Droplet,
  BookOpen,
  Dumbbell,
  Brain,
  Footprints,
  Code,
  Coffee,
  PenLine,
};

const ICON_OPTIONS = Object.keys(ICONS);
const TIME_FILTERS = [
  { key: "all", label: "All" },
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
];

const TIME_OF_DAY_OPTIONS = [
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
  { key: "anytime", label: "Anytime" },
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayStr() {
  return toDateStr(new Date());
}

function formatHeaderDate(d) {
  const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
  const day = d.getDate();
  const month = d.toLocaleDateString(undefined, { month: "short" });
  return { weekday, dateLine: `${day} ${month}` };
}

function last7Dates() {
  const out = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(toDateStr(d));
  }
  return out;
}

function calcStreak(completedDates) {
  if (!completedDates || completedDates.length === 0) return 0;
  const set = new Set(completedDates);
  let streak = 0;
  const cursor = new Date();
  if (!set.has(toDateStr(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (set.has(toDateStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let dataUrl = canvas.toDataURL("image/webp", 0.8);
  if (!dataUrl.startsWith("data:image/webp")) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  }
  return dataUrl;
}

function useTheme() {
  const [theme, setTheme] = useState("light");
  const isDark = theme === "dark";
  const t = isDark
    ? {
        canvas: "bg-gray-900",
        shell: "bg-gray-900",
        surface: "bg-gray-800",
        card: "bg-gray-800",
        border: "border-gray-700",
        textPrimary: "text-gray-50",
        textSecondary: "text-gray-400",
        textMuted: "text-gray-500",
        badge: "bg-gray-700",
        ring: "border-gray-600",
        inputBg: "bg-gray-800",
        inputBorder: "border-gray-700",
        track: "bg-gray-700",
        pillActive: "bg-gray-700",
        pillTrack: "bg-gray-800",
        overlay: "bg-black/60",
        dot: "bg-gray-700",
      }
    : {
        canvas: "bg-gray-50",
        shell: "bg-gray-50",
        surface: "bg-white",
        card: "bg-white",
        border: "border-gray-100",
        textPrimary: "text-gray-900",
        textSecondary: "text-gray-500",
        textMuted: "text-gray-400",
        badge: "bg-gray-100",
        ring: "border-gray-200",
        inputBg: "bg-gray-50",
        inputBorder: "border-gray-200",
        track: "bg-gray-100",
        pillActive: "bg-white",
        pillTrack: "bg-gray-100",
        overlay: "bg-black/40",
        dot: "bg-gray-200",
      };
  return { theme, setTheme, isDark, t };
}

/* ---------------------------------------------------------------
   Auth Screens
--------------------------------------------------------------- */

function LoginScreen({ t, onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignup) {
        await supabase.signup(email, password);
      } else {
        await supabase.login(email, password);
      }
      const user = await supabase.getUser();
      onLoginSuccess(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${t.canvas} p-4`}>
      <div className={`w-full max-w-md ${t.card} rounded-2xl border ${t.border} shadow-lg p-6`}>
        <h1 className={`text-2xl font-semibold ${t.textPrimary} mb-6`}>
          {isSignup ? "Create account" : "Welcome back"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`text-sm font-medium ${t.textSecondary} mb-1.5 block`}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={`w-full rounded-xl px-3.5 py-2.5 text-sm ${t.inputBg} border ${t.inputBorder} ${t.textPrimary} outline-none focus:border-blue-500`}
            />
          </div>

          <div>
            <label className={`text-sm font-medium ${t.textSecondary} mb-1.5 block`}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={`w-full rounded-xl px-3.5 py-2.5 text-sm ${t.inputBg} border ${t.inputBorder} ${t.textPrimary} outline-none focus:border-blue-500`}
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 text-sm font-semibold bg-blue-600 text-white disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader size={14} className="animate-spin" />}
            {isSignup ? "Sign up" : "Sign in"}
          </button>
        </form>

        <button
          onClick={() => {
            setIsSignup(!isSignup);
            setError("");
          }}
          className={`w-full mt-4 text-sm ${t.textSecondary} underline`}
        >
          {isSignup ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Header
--------------------------------------------------------------- */

function Header({ t, isDark, onToggleTheme, completedCount, totalCount, user, onLogout }) {
  const { weekday, dateLine } = formatHeaderDate(new Date());
  const pct = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return (
    <div className="px-5 pt-6 pb-4">
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-[11px] font-semibold tracking-wide ${t.textMuted}`}>
            {weekday}
          </p>
          <h1 className={`text-2xl font-semibold ${t.textPrimary} mt-0.5`}>
            {dateLine}
          </h1>
          <p className={`text-xs ${t.textMuted} mt-1`}>{user?.email}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className={`w-10 h-10 rounded-full flex items-center justify-center ${t.badge} ${t.textSecondary} transition-colors duration-200 active:scale-95`}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={onLogout}
            aria-label="Logout"
            className={`w-10 h-10 rounded-full flex items-center justify-center ${t.badge} ${t.textSecondary} transition-colors duration-200 active:scale-95 hover:text-red-500`}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className={`mt-5 rounded-2xl ${t.card} border ${t.border} shadow-sm p-4`}>
        <div className="flex items-center justify-between mb-2.5">
          <span className={`text-sm font-medium ${t.textSecondary}`}>Daily goal</span>
          <span className="text-sm font-semibold text-blue-600">
            {completedCount} of {totalCount} completed
          </span>
        </div>
        <div className={`h-1.5 rounded-full ${t.track} overflow-hidden`}>
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Filter bar
--------------------------------------------------------------- */

function FilterBar({ t, active, onChange }) {
  const idx = TIME_FILTERS.findIndex((f) => f.key === active);
  return (
    <div className="px-5 mb-4">
      <div className={`relative grid grid-cols-4 rounded-full p-1 ${t.pillTrack}`}>
        <div
          className={`absolute top-1 bottom-1 rounded-full ${t.pillActive} shadow-sm transition-transform duration-300 ease-out`}
          style={{
            width: `calc(25% - 4px)`,
            transform: `translateX(calc(${idx} * 100% + ${idx * 4}px))`,
            left: "2px",
          }}
        />
        {TIME_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => onChange(f.key)}
            className={`relative z-10 text-xs font-medium py-2 rounded-full transition-colors duration-200 ${
              active === f.key ? t.textPrimary : t.textMuted
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Habit card
--------------------------------------------------------------- */

function HeatmapRow({ t, completedDates }) {
  const days = last7Dates();
  const set = new Set(completedDates);
  return (
    <div className="flex items-center gap-1 mt-2">
      {days.map((d) => (
        <span
          key={d}
          className={`w-4 h-2 rounded-sm ${set.has(d) ? "bg-blue-500" : t.dot}`}
        />
      ))}
    </div>
  );
}

function HabitCard({ t, habit, onToggle, onDelete }) {
  const Icon = ICONS[habit.icon] || Droplet;
  const doneToday = habit.completedDates.includes(todayStr());
  const [pressed, setPressed] = useState(false);
  const timeLabel = habit.timeOfDay.charAt(0).toUpperCase() + habit.timeOfDay.slice(1);

  return (
    <div className={`rounded-2xl ${t.card} border ${t.border} shadow-sm p-4 flex items-start gap-3 group`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.badge}`}>
        <Icon size={18} className={t.textSecondary} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`font-medium truncate ${t.textPrimary}`}>{habit.title}</p>
          <button
            onClick={() => onDelete(habit.id)}
            className={`opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${t.textMuted} hover:text-red-500 shrink-0`}
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div className={`flex items-center gap-1.5 mt-1 text-xs ${t.textSecondary}`}>
          {habit.streak > 0 ? (
            <span className="inline-flex items-center gap-1 text-orange-500 font-medium">
              <Flame size={12} className="fill-orange-500" />
              {habit.streak}-day streak
            </span>
          ) : (
            <span>No streak yet</span>
          )}
          <span className={t.textMuted}>•</span>
          <span>{timeLabel}</span>
        </div>
        <HeatmapRow t={t} completedDates={habit.completedDates} />
      </div>

      <button
        onClick={() => onToggle(habit.id)}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ease-out
          ${doneToday ? "bg-blue-600" : `border-2 ${t.ring} bg-transparent`}
          ${pressed ? "scale-90" : "scale-100"}
        `}
      >
        {doneToday && <Check size={16} className="text-white" strokeWidth={3} />}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------
   Add Habit Modal
--------------------------------------------------------------- */

function AddHabitSheet({ t, open, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("morning");
  const [icon, setIcon] = useState("Droplet");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setTimeOfDay("morning");
      setIcon("Droplet");
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [open]);

  if (!open) return null;

  const canSave = title.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setLoading(true);
    try {
      await onSave({ title: title.trim(), timeOfDay, icon });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className={`absolute inset-0 ${t.overlay}`} onClick={onClose} />
      <div className={`relative w-full max-w-md ${t.surface} rounded-t-2xl p-5 pb-8 shadow-lg`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className={`text-lg font-semibold ${t.textPrimary}`}>New habit</h2>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center ${t.badge} ${t.textSecondary}`}
          >
            <X size={16} />
          </button>
        </div>

        <label className={`text-xs font-medium ${t.textSecondary} mb-1.5 block`}>Title</label>
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="e.g. Drink 2L water"
          className={`w-full rounded-xl px-3.5 py-2.5 text-sm ${t.inputBg} border ${t.inputBorder} ${t.textPrimary} outline-none focus:border-blue-500 mb-5`}
        />

        <label className={`text-xs font-medium ${t.textSecondary} mb-1.5 block`}>Time of day</label>
        <div className="grid grid-cols-4 gap-1.5 mb-5">
          {TIME_OF_DAY_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => setTimeOfDay(o.key)}
              className={`text-xs font-medium py-2 rounded-full transition-colors duration-150 ${
                timeOfDay === o.key
                  ? "bg-blue-600 text-white"
                  : `${t.pillTrack} ${t.textSecondary}`
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <label className={`text-xs font-medium ${t.textSecondary} mb-1.5 block`}>Icon</label>
        <div className="grid grid-cols-4 gap-2 mb-6">
          {ICON_OPTIONS.map((name) => {
            const IconComp = ICONS[name];
            const selected = icon === name;
            return (
              <button
                key={name}
                onClick={() => setIcon(name)}
                className={`h-11 rounded-xl flex items-center justify-center transition-colors duration-150 ${
                  selected ? "bg-blue-600 text-white" : `${t.badge} ${t.textSecondary}`
                }`}
              >
                <IconComp size={17} />
              </button>
            );
          })}
        </div>

        <button
          onClick={handleSave}
          disabled={!canSave || loading}
          className={`w-full rounded-xl py-3 text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 ${
            canSave && !loading
              ? "bg-blue-600 text-white active:scale-[0.98]"
              : `${t.pillTrack} ${t.textMuted} cursor-not-allowed`
          }`}
        >
          {loading && <Loader size={14} className="animate-spin" />}
          {loading ? "Saving..." : "Save habit"}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Daily Journal
--------------------------------------------------------------- */

function DailyJournal({ t, journal, onChangeText, onAddImage, onRemoveImage }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      await onAddImage(compressed);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="px-5 mt-2 mb-6">
      <p className={`text-xs font-semibold ${t.textMuted} mb-2`}>Today's journal</p>
      <div className={`rounded-2xl ${t.card} border ${t.border} shadow-sm p-4`}>
        <textarea
          value={journal.noteText}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="How did today go? Add notes or memories..."
          rows={4}
          className={`w-full bg-transparent outline-none resize-none text-sm ${t.textPrimary} placeholder:${t.textMuted}`}
        />

        {journal.images && journal.images.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {journal.images.map((src, i) => (
              <div key={i} className="relative shrink-0">
                <img
                  src={src}
                  alt={`Attachment ${i + 1}`}
                  className="w-20 h-20 rounded-xl object-cover"
                />
                <button
                  onClick={() => onRemoveImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-sm"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={`flex items-center justify-between mt-3 pt-3 border-t ${t.border}`}>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${t.textSecondary} disabled:opacity-50`}
          >
            <ImagePlus size={14} />
            {uploading ? "Uploading…" : "Attach image"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
          <span className={`text-[11px] ${t.textMuted}`}>Auto-syncs</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   App
--------------------------------------------------------------- */

export default function App() {
  const { theme, setTheme, isDark, t } = useTheme();
  const [user, setUser] = useState(null);
  const [habits, setHabits] = useState([]);
  const [journals, setJournals] = useState({});
  const [activeFilter, setActiveFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const journalSyncTimer = useRef(null);

  const today = todayStr();
  const journal = journals[today] || { noteText: "", images: [] };

  // Check session on mount and fetch user data
  useEffect(() => {
    (async () => {
      try {
        const session = await supabase.getSession();
        if (session?.access_token) {
          const user = await supabase.getUser();
          if (user) {
            setUser(user);
            await fetchUserData(user.id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchUserData = async (userId) => {
    try {
      // Fetch habits
      const dbHabits = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId);

      // Fetch completions
      const dbCompletions = await supabase
        .from("habit_completions")
        .select("*")
        .in("habit_id", dbHabits.map((h) => h.id) || []);

      // Build local habit state
      const habitsMap = {};
      dbHabits.forEach((h) => {
        const completedDates = dbCompletions
          .filter((c) => c.habit_id === h.id)
          .map((c) => c.completed_date);
        habitsMap[h.id] = {
          id: h.id,
          title: h.title,
          icon: h.icon,
          timeOfDay: h.time_of_day,
          createdAt: h.created_at.split("T")[0],
          completedDates,
          streak: calcStreak(completedDates),
        };
      });
      setHabits(Object.values(habitsMap));

      // Fetch journals
      const dbJournals = await supabase
        .from("daily_journals")
        .select("*")
        .eq("user_id", userId);

      const journalsMap = {};
      dbJournals.forEach((j) => {
        journalsMap[j.date] = {
          noteText: j.note_text || "",
          images: j.images || [],
        };
      });
      setJournals(journalsMap);
    } catch (err) {
      console.error("Failed to fetch user data:", err);
    }
  };

  const toggleHabit = async (habitId) => {
    const habit = habits.find((h) => h.id === habitId);
    const isCompleted = habit.completedDates.includes(today);

    // Optimistic update
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const completedDates = isCompleted
          ? h.completedDates.filter((d) => d !== today)
          : [...h.completedDates, today];
        return { ...h, completedDates, streak: calcStreak(completedDates) };
      })
    );

    // Sync to Supabase
    try {
      setSyncing(true);
      if (isCompleted) {
        await supabase
          .from("habit_completions")
          .delete()
          .eq("habit_id", habitId)
          .eq("completed_date", today);
      } else {
        await supabase
          .from("habit_completions")
          .insert({ habit_id: habitId, completed_date: today });
      }
    } catch (err) {
      console.error(err);
      // Revert on error
      await fetchUserData(user.id);
    } finally {
      setSyncing(false);
    }
  };

  const addHabit = async (input) => {
    try {
      setSyncing(true);
      const { data } = await supabase.from("habits").insert({
        user_id: user.id,
        title: input.title,
        icon: input.icon,
        time_of_day: input.timeOfDay,
      });

      // Add to local state
      setHabits((prev) => [
        ...prev,
        {
          id: data?.[0]?.id || uid(),
          title: input.title,
          icon: input.icon,
          timeOfDay: input.timeOfDay,
          createdAt: today,
          completedDates: [],
          streak: 0,
        },
      ]);
    } catch (err) {
      console.error(err);
      alert("Failed to create habit");
    } finally {
      setSyncing(false);
    }
  };

  const deleteHabit = async (habitId) => {
    try {
      setSyncing(true);
      await supabase.from("habits").delete().eq("id", habitId);
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const setJournalText = (text) => {
    setJournals((prev) => ({
      ...prev,
      [today]: { ...prev[today], noteText: text },
    }));

    // Debounced sync
    if (journalSyncTimer.current) clearTimeout(journalSyncTimer.current);
    journalSyncTimer.current = setTimeout(() => syncJournal(text, journal.images), 500);
  };

  const addJournalImage = async (base64) => {
    const updated = [...(journal.images || []), base64];
    setJournals((prev) => ({
      ...prev,
      [today]: { ...prev[today], images: updated },
    }));
    await syncJournal(journal.noteText, updated);
  };

  const removeJournalImage = async (index) => {
    const updated = journal.images.filter((_, i) => i !== index);
    setJournals((prev) => ({
      ...prev,
      [today]: { ...prev[today], images: updated },
    }));
    await syncJournal(journal.noteText, updated);
  };

  const syncJournal = async (noteText, images) => {
    try {
      setSyncing(true);
      await supabase.from("daily_journals").upsert({
        user_id: user.id,
        date: today,
        note_text: noteText,
        images,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Journal sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    await supabase.logout();
    setUser(null);
    setHabits([]);
    setJournals({});
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${t.canvas}`}>
        <div className={`text-sm ${t.textMuted}`}>Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen t={t} onLoginSuccess={(u) => {
      setUser(u);
      fetchUserData(u.id);
    }} />;
  }

  const filteredHabits = activeFilter === "all" ? habits : habits.filter((h) => h.timeOfDay === activeFilter);
  const completedCount = habits.filter((h) => h.completedDates.includes(today)).length;
  const totalCount = habits.length;

  return (
    <div className={`min-h-screen ${t.shell} flex justify-center relative`}>
      <div className={`w-full max-w-md min-h-screen ${t.canvas} shadow-lg`}>
        <Header
          t={t}
          isDark={isDark}
          onToggleTheme={() => setTheme(isDark ? "light" : "dark")}
          completedCount={completedCount}
          totalCount={totalCount}
          user={user}
          onLogout={handleLogout}
        />

        <FilterBar t={t} active={activeFilter} onChange={setActiveFilter} />

        <div className="px-5 flex flex-col gap-3">
          {filteredHabits.length === 0 ? (
            <div className={`rounded-2xl border ${t.border} ${t.card} p-6 text-center`}>
              <p className={`text-sm ${t.textSecondary}`}>
                No habits yet. Add one with the button below.
              </p>
            </div>
          ) : (
            filteredHabits.map((h) => (
              <HabitCard
                key={h.id}
                t={t}
                habit={h}
                onToggle={toggleHabit}
                onDelete={deleteHabit}
              />
            ))
          )}
        </div>

        <DailyJournal
          t={t}
          journal={journal}
          onChangeText={setJournalText}
          onAddImage={addJournalImage}
          onRemoveImage={removeJournalImage}
        />

        {syncing && (
          <div className={`fixed top-4 right-4 px-3 py-1.5 rounded-full ${t.badge} text-xs ${t.textMuted} flex items-center gap-1.5`}>
            <Loader size={12} className="animate-spin" />
            Syncing…
          </div>
        )}

        <button
          onClick={() => setModalOpen(true)}
          className="fixed bottom-8 right-6 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform duration-150 z-40"
        >
          <Plus size={24} />
        </button>

        <AddHabitSheet
          t={t}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={addHabit}
        />
      </div>
    </div>
  );
}
