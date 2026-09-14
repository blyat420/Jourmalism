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
  AlertCircle,
  CheckCircle,
  Info,
  User,
  ArrowLeft,
  MoreVertical,
  Clock3,
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
    const responseText = await res.text();
    return responseText ? JSON.parse(responseText) : null;
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
    const opts = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.client.key,
        Authorization: `Bearer ${this.client.session?.access_token || this.client.key}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(data),
    };
    const res = await fetch(`${this.client.url}/rest/v1/${this.name}`, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.message || `HTTP ${res.status}`);
      error.code = err.code;
      throw error;
    }
    const responseText = await res.text();
    return responseText ? JSON.parse(responseText) : null;
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
  User, 
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

const DEFAULT_REMINDER = {
  frequency: "every day",
  activeDays: ["M", "T", "W", "T", "F", "S", "S"],
  hour: "08",
  minute: "00",
  period: "AM",
};

const REMINDER_DAYS = ["M", "T", "W", "T", "F", "S", "S"];

function ReminderModal({ t, habit, onClose, onSave }) {
  const [reminder, setReminder] = useState({
    ...DEFAULT_REMINDER,
    ...(habit.reminderSettings || {}),
    activeDays: habit.reminderSettings?.activeDays || DEFAULT_REMINDER.activeDays,
  });
  const [saving, setSaving] = useState(false);

  const toggleDay = (index) => {
    setReminder((current) => ({
      ...current,
      frequency: "specific days",
      activeDays: current.activeDays.map((day, dayIndex) =>
        dayIndex === index ? (day ? "" : REMINDER_DAYS[index]) : day
      ),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const saved = await onSave(reminder);
    setSaving(false);
    if (saved) onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center">
      <div className={`w-full max-w-sm rounded-[24px] ${t.surface} p-5 shadow-2xl`}>
        <div className={`flex items-start justify-between border-b ${t.border} pb-4`}>
          <div>
            <h2 className={`text-base font-bold ${t.textPrimary}`}>Edit Reminder</h2>
            <p className={`mt-1 text-[11px] ${t.textMuted}`}>Customize alerts and schedule for your habit</p>
          </div>
          <button onClick={onClose} aria-label="Close reminder" className={`w-8 h-8 rounded-full ${t.badge} ${t.textMuted} flex items-center justify-center`}>
            <X size={16} />
          </button>
        </div>

        <div className="pt-4">
          <p className={`mb-2 text-[10px] font-bold tracking-wide ${t.textMuted}`}>REPEAT FREQUENCY</p>
          <div className={`grid grid-cols-3 gap-1 rounded-xl ${t.badge} p-1`}>
            {["every day", "specific days", "custom"].map((frequency) => (
              <button
                key={frequency}
                onClick={() => setReminder((current) => ({ ...current, frequency }))}
                className={`rounded-lg py-2 text-[10px] font-bold capitalize ${reminder.frequency === frequency ? `${t.surface} text-blue-600 shadow-sm` : t.textMuted}`}
              >
                {frequency}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className={`text-[10px] font-bold tracking-wide ${t.textMuted}`}>ACTIVE DAYS</p>
            <span className="text-[10px] font-bold text-blue-600">
              {reminder.frequency === "every day" ? "Every day" : reminder.activeDays.filter(Boolean).join(", ") || "Choose days"}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {REMINDER_DAYS.map((day, index) => {
              const active = reminder.frequency === "every day" || reminder.activeDays[index];
              return (
                <button
                  key={`${day}-${index}`}
                  onClick={() => toggleDay(index)}
                  className={`h-8 rounded-full text-[10px] font-bold ${active ? "bg-blue-600 text-white" : `${t.badge} ${t.textMuted}`}`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <p className={`mb-2 mt-5 text-[10px] font-bold tracking-wide ${t.textMuted}`}>REMINDER TIME</p>
          <div className={`flex items-center gap-2 rounded-xl ${t.badge} p-2`}>
            <Clock3 size={16} className="text-blue-600" />
            <input
              aria-label="Reminder hour"
              value={reminder.hour}
              onChange={(event) => setReminder((current) => ({ ...current, hour: event.target.value.replace(/\D/g, "").slice(0, 2) }))}
              className={`w-10 rounded-lg ${t.surface} py-2 text-center text-sm font-bold ${t.textPrimary} outline-none`}
            />
            <span className={t.textMuted}>:</span>
            <input
              aria-label="Reminder minute"
              value={reminder.minute}
              onChange={(event) => setReminder((current) => ({ ...current, minute: event.target.value.replace(/\D/g, "").slice(0, 2) }))}
              className={`w-10 rounded-lg ${t.surface} py-2 text-center text-sm font-bold ${t.textPrimary} outline-none`}
            />
            <div className={`ml-auto flex rounded-lg ${t.surface} p-1`}>
              {["AM", "PM"].map((period) => (
                <button
                  key={period}
                  onClick={() => setReminder((current) => ({ ...current, period }))}
                  className={`rounded-md px-3 py-1.5 text-[10px] font-bold ${reminder.period === period ? "bg-blue-600 text-white" : t.textMuted}`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`mt-5 flex items-center justify-end gap-3 border-t ${t.border} pt-4`}>
          <button onClick={onClose} className={`px-3 py-2 text-xs font-semibold ${t.textMuted}`}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/20 disabled:opacity-50">
            {saving ? "Saving..." : <><Check size={14} className="mr-1 inline" />Save Reminder</>}
          </button>
        </div>
      </div>
    </div>
  );
}
/* ---------------------------------------------------------------
   Habit Detail Screen
--------------------------------------------------------------- */

function HabitDetailScreen({ t, habit, onClose, onSaveNote, onSaveReminder }) {
  const [note, setNote] = useState(habit.notes || "");
  const [saving, setSaving] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const reminder = { ...DEFAULT_REMINDER, ...(habit.reminderSettings || {}) };
  const reminderSummary = reminder.frequency === "every day"
    ? `Every day at ${reminder.hour}:${reminder.minute} ${reminder.period}`
    : `${reminder.activeDays?.filter(Boolean).join(", ") || "Selected days"} at ${reminder.hour}:${reminder.minute} ${reminder.period}`;
  const recentDates = last7Dates();
  const completedDates = new Set(habit.completedDates || []);

  const bestStreak = [...completedDates].sort().reduce((best, date, index, dates) => {
    if (index === 0) return 1;
    const previous = new Date(`${dates[index - 1]}T00:00:00`);
    const current = new Date(`${date}T00:00:00`);
    const daysApart = Math.round((current - previous) / 86400000);
    return daysApart === 1 ? Math.max(best, index + 1) : Math.max(best, 1);
  }, completedDates.size ? 1 : 0);

  const handleSave = async () => {
    setSaving(true);
    await onSaveNote(habit.id, note);
    setSaving(false);
  };

  return (
    <div className={`min-h-screen ${t.canvas} flex flex-col absolute inset-0 z-50 animate-[slideIn_0.2s_ease-out]`}>
      <style>{`@keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-4">
          <button onClick={onClose} aria-label="Back" className={`w-9 h-9 -ml-1 rounded-full flex items-center justify-center ${t.textPrimary}`}>
            <ArrowLeft size={23} strokeWidth={2.4} />
          </button>
          <h1 className={`text-[24px] font-bold tracking-tight ${t.textPrimary}`}>{habit.title}</h1>
        </div>
        <button aria-label="More options" className={`w-9 h-9 rounded-full flex items-center justify-center ${t.textSecondary}`}>
          <MoreVertical size={20} />
        </button>
      </div>

      <div className="px-5 flex-1 overflow-y-auto pb-28">
        <section className={`rounded-[24px] ${t.card} border ${t.border} shadow-sm px-5 pt-5 pb-4 mb-6`}>
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 dark:bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-600 dark:text-orange-300">
              <Flame size={13} fill="currentColor" /> Active Streak
            </span>
            <div className="text-right">
              <p className={`text-[11px] ${t.textMuted}`}>Personal Best</p>
              <p className={`text-sm font-bold ${t.textPrimary}`}>{bestStreak} days</p>
            </div>
          </div>

          <div className="flex items-end gap-2 border-b border-gray-100 dark:border-gray-700 pb-4">
            <span className={`text-[30px] leading-none font-bold ${t.textPrimary}`}>{habit.streak}</span>
            <span className={`text-sm pb-0.5 ${t.textSecondary}`}>days streak</span>
          </div>

          <div className="flex items-center justify-between mt-3 mb-2">
            <span className={`text-xs ${t.textMuted}`}>Last 7 Days</span>
            <span className="text-xs font-bold text-blue-600">{Math.round((recentDates.filter((date) => completedDates.has(date)).length / 7) * 100)}% completion</span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {recentDates.map((date) => {
              const dateObject = new Date(`${date}T00:00:00`);
              const isToday = date === todayStr();
              const complete = completedDates.has(date);
              return (
                <div key={date} className="flex flex-col items-center gap-2">
                  <span className={`text-[10px] ${isToday ? "font-bold text-blue-600" : t.textMuted}`}>
                    {isToday ? "Today" : dateObject.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1)}
                  </span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${complete ? "bg-blue-600 text-white" : isToday ? "border-2 border-dashed border-blue-500 text-blue-600" : `${t.badge} ${t.textMuted}`}`}>
                    {complete ? <Check size={16} strokeWidth={3} /> : isToday ? <Plus size={17} /> : <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />}
                  </div>
                </div>
              );
            })}
          </div>
          </section>

        <section className="mb-5">
          <h2 className={`text-sm font-bold ${t.textPrimary} mb-3`}>Notes</h2>
          <div className={`rounded-[24px] ${t.card} border ${t.border} p-3`}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write a note about this habit..."
              rows={8}
              className={`w-full rounded-xl ${t.inputBg} border ${t.border} p-4 text-sm leading-6 ${t.textPrimary} outline-none resize-none focus:border-blue-500`}
            />
          </div>
        </section>

        <div className={`flex items-center gap-3 rounded-2xl ${t.card} border ${t.border} px-4 py-3.5`}>
          <div className={`w-9 h-9 rounded-xl ${t.badge} flex items-center justify-center`}>
            <Clock3 size={17} className={t.textSecondary} />
          </div>
          <div className="flex-1">
            <p className={`text-xs font-bold ${t.textPrimary}`}>Reminder</p>
            <p className={`text-xs ${t.textMuted}`}>{reminderSummary}</p>
          </div>
          <button onClick={() => setReminderOpen(true)} className="text-xs font-bold text-blue-600">Edit</button>
        </div>
      </div>

      <div className={`absolute bottom-0 left-0 right-0 ${t.canvas} border-t ${t.border} px-5 py-4 flex items-center gap-3`}>
        <button aria-label="Reset note" onClick={() => setNote(habit.notes || "")} className={`w-12 h-12 rounded-2xl border ${t.border} ${t.card} flex items-center justify-center ${t.textSecondary}`}>
          <Clock3 size={18} />
        </button>
        <button
          onClick={handleSave}
          disabled={saving || note === (habit.notes || "")}
          className="flex-1 h-12 rounded-2xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:shadow-none"
        >
          {saving ? "Saving..." : <><Check size={16} className="inline mr-2" />Save Changes</>}
        </button>
      </div>

      {reminderOpen && (
        <ReminderModal
          t={t}
          habit={habit}
          onClose={() => setReminderOpen(false)}
          onSave={(reminder) => onSaveReminder(habit.id, reminder)}
        />
      )}
    </div>
  );
}

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

/* ---------------------------------------------------------------
   Toast Notification System
--------------------------------------------------------------- */

function Toast({ message, type = "info", icon: Icon, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgClass = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-blue-500",
    warning: "bg-yellow-500",
  }[type];

  return (
    <div
      className={`fixed top-4 left-4 right-4 max-w-md mx-auto ${bgClass} text-white rounded-lg shadow-lg p-4 flex items-center gap-3 animate-[slideDown_0.3s_ease-out] z-50`}
      style={{ animation: "slideDown 0.3s ease-out" }}
    >
      {Icon && <Icon size={18} className="shrink-0" />}
      <span className="text-sm font-medium flex-1">{message}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100">
        <X size={16} />
      </button>
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = "info", icon = null) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, icon }]);
    return id;
  }, []);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, show, remove };
}

/* ---------------------------------------------------------------
   Theme System
--------------------------------------------------------------- */

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
  const [mode, setMode] = useState("choose"); // "choose" | "login" | "signup" | "verify"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toasts, show, remove } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        await supabase.signup(email, password);
        show(`Verification email sent to ${email}`, "success", CheckCircle);
        setMode("verify");
        setEmail("");
        setPassword("");
      } else {
        await supabase.login(email, password);
        const user = await supabase.getUser();
        if (user) {
          show("Welcome back!", "success", CheckCircle);
          onLoginSuccess(user);
        }
      }
    } catch (err) {
      setError(err.message);
      show(err.message, "error", AlertCircle);
    } finally {
      setLoading(false);
    }
  };

  // Mode: "verify" — email verification screen
  if (mode === "verify") {
    return (
      <div className={`min-h-screen flex items-center justify-center ${t.canvas} p-4`}>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            icon={toast.icon}
            onClose={() => remove(toast.id)}
          />
        ))}
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className={`w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4`}>
              <CheckCircle size={32} className="text-blue-600" />
            </div>
            <h1 className={`text-2xl font-bold ${t.textPrimary} mb-2`}>
              Check your email
            </h1>
            <p className={`text-sm ${t.textSecondary}`}>
              We've sent a verification link to your inbox. Click it to confirm your account.
            </p>
          </div>

          <div className={`rounded-xl ${t.card} border ${t.border} p-4 mb-6`}>
            <p className={`text-xs ${t.textMuted} text-center`}>
              Didn't receive it? Check your spam folder or <button onClick={() => {
                setMode("signup");
                setError("");
              }} className="text-blue-600 font-semibold hover:underline">try again</button>
            </p>
          </div>

          <button
            onClick={() => setMode("choose")}
            className={`w-full rounded-xl py-3 text-sm font-semibold border-2 border-blue-600 ${t.textPrimary} transition-all duration-200`}
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  // Mode: "choose" — show two big buttons
  if (mode === "choose") {
    return (
      <div className={`min-h-screen flex items-center justify-center ${t.canvas} p-4`}>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            icon={toast.icon}
            onClose={() => remove(toast.id)}
          />
        ))}
        <div className="w-full max-w-md">
          <div className="mb-12 text-center">
            <h1 className={`text-3xl font-bold ${t.textPrimary} mb-2`}>Routine</h1>
            <p className={`text-sm ${t.textSecondary}`}>
              Build habits, track progress, reflect daily
            </p>
          </div>

          <div className="space-y-3">
            {/* Sign In Button */}
            <button
              onClick={() => {
                setMode("login");
                setError("");
                setEmail("");
                setPassword("");
              }}
              className={`w-full rounded-2xl py-4 px-4 border-2 border-blue-600 ${t.textPrimary} font-semibold text-base transition-all duration-200 active:scale-[0.98] hover:bg-blue-600/10`}
            >
              Sign in
            </button>

            {/* Create Account Button */}
            <button
              onClick={() => {
                setMode("signup");
                setError("");
                setEmail("");
                setPassword("");
              }}
              className="w-full rounded-2xl py-4 px-4 bg-blue-600 text-white font-semibold text-base transition-all duration-200 active:scale-[0.98] hover:bg-blue-700"
            >
              Create account
            </button>
          </div>

          <p className={`text-xs ${t.textMuted} text-center mt-6`}>
            Verification email required. We'll send a confirmation link.
          </p>
        </div>
      </div>
    );
  }

  // Mode: "login" or "signup" — show form
  const isSignup = mode === "signup";
  return (
    <div className={`min-h-screen flex items-center justify-center ${t.canvas} p-4`}>
      <style>{`@keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          icon={toast.icon}
          onClose={() => remove(toast.id)}
        />
      ))}
      <div className={`w-full max-w-md ${t.card} rounded-2xl border ${t.border} shadow-lg p-8`}>
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => setMode("choose")}
            className={`text-sm ${t.textSecondary} hover:${t.textPrimary} mb-4 transition-colors`}
          >
            ← Back
          </button>
          <h1 className={`text-2xl font-bold ${t.textPrimary} mb-1`}>
            {isSignup ? "Join Routine" : "Welcome back"}
          </h1>
          <p className={`text-sm ${t.textSecondary}`}>
            {isSignup
              ? "Track habits with your friends"
              : "Pick up where you left off"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className={`text-xs font-semibold tracking-wide ${t.textMuted} mb-2 block uppercase`}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isSignup ? "you@example.com" : ""}
              required
              autoFocus
              className={`w-full rounded-xl px-3.5 py-3 text-sm ${t.inputBg} border ${t.inputBorder} ${t.textPrimary} outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          </div>

          {/* Password */}
          <div>
            <label className={`text-xs font-semibold tracking-wide ${t.textMuted} mb-2 block uppercase`}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? "At least 8 characters" : ""}
              required
              className={`w-full rounded-xl px-3.5 py-3 text-sm ${t.inputBg} border ${t.inputBorder} ${t.textPrimary} outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
            {isSignup && (
              <p className={`text-xs ${t.textMuted} mt-1.5`}>
                Use at least 8 characters
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
              <p className="text-xs text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 text-sm font-semibold bg-blue-600 text-white disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-150 mt-6"
          >
            {loading && <Loader size={14} className="animate-spin" />}
            {isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        {/* Footer Info */}
        <div className={`mt-6 pt-6 border-t ${t.border}`}>
          <p className={`text-xs ${t.textMuted} text-center`}>
            {isSignup ? (
              <>Already have an account? <button onClick={() => setMode("login")} className="text-blue-600 font-semibold hover:underline">Sign in instead</button></>
            ) : (
              <>Don't have an account? <button onClick={() => setMode("signup")} className="text-blue-600 font-semibold hover:underline">Create one</button></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Header
--------------------------------------------------------------- */

function Header({ t, isDark, onToggleTheme, completedCount, totalCount, user, onLogout }) {
  const pct = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  // Extract the username from the email to display "Hi, [Name]!"
  const rawName = user?.email?.split('@')[0] || 'User';
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  return (
    <div className="px-5 pt-8 pb-4">
      {/* Top Profile & Actions Row */}
      <div className="flex items-center justify-between mb-6">
        
        {/* User Info */}
        <div className="flex items-center gap-3.5">
          <div className={`w-[52px] h-[52px] rounded-full flex items-center justify-center ${t.card} shrink-0 shadow-sm border ${t.border}`}>
            <User size={26} className={t.textPrimary} fill="currentColor" strokeWidth={1} />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${t.textPrimary} tracking-tight`}>
              Hi, {displayName}!
            </h1>
            <p className={`text-[13px] ${t.textSecondary} mt-0.5`}>
              @{user?.email}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2.5">
          <button
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="w-[32px] h-[32px] rounded-full flex items-center justify-center bg-blue-600 text-white transition-all duration-200 active:scale-95 hover:bg-blue-700 shadow-sm"
          >
            {isDark ? <Sun size={10} strokeWidth={2.5} /> : <Moon size={10} strokeWidth={2.5} />}
          </button>
          <button
            onClick={onLogout}
            aria-label="Logout"
            className="w-[32px] h-[32px] rounded-full flex items-center justify-center bg-blue-600 text-white transition-all duration-200 active:scale-95 hover:bg-blue-700 shadow-sm"
          >
            <LogOut size={10} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Daily Goal Progress Bar */}
      <div className={`rounded-2xl ${t.card} border ${t.border} shadow-sm p-4`}>
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

/* ---------------------------------------------------------------
   Habit card
--------------------------------------------------------------- */

function HabitCard({ t, habit, onToggle, onDelete, onOpenDetails }) {
  const Icon = ICONS[habit.icon] || Droplet;
  const doneToday = habit.completedDates.includes(todayStr());
  const [pressed, setPressed] = useState(false);
  const timeLabel = habit.timeOfDay.charAt(0).toUpperCase() + habit.timeOfDay.slice(1);

  return (
    <div 
      onClick={() => onOpenDetails(habit.id)}
      className={`rounded-2xl ${t.card} border ${t.border} shadow-sm p-4 flex items-start gap-3 group cursor-pointer hover:border-blue-500/30 transition-colors`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.badge}`}>
        <Icon size={18} className={t.textSecondary} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`font-medium truncate ${t.textPrimary}`}>{habit.title}</p>
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevents opening details when deleting
              onDelete(habit.id);
            }}
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
        onClick={(e) => {
          e.stopPropagation(); // Prevents opening details when checking off
          onToggle(habit.id);
        }}
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
      const saved = await onSave({ title: title.trim(), timeOfDay, icon });
      if (saved) onClose();
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
  const [selectedHabitId, setSelectedHabitId] = useState(null); 
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const journalSyncTimer = useRef(null);
  const { toasts, show, remove } = useToast();

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

      // Completion history is optional for restoring the habit list.
      let dbCompletions = [];
      const habitIds = dbHabits.map((h) => h.id);
      if (habitIds.length > 0) {
        try {
          dbCompletions = await supabase
            .from("habit_completions")
            .select("*")
            .in("habit_id", habitIds);
        } catch (err) {
          console.error("Failed to fetch completion history:", err);
        }
      }

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
          notes: h.notes || "",
          reminderSettings: h.reminder_settings || DEFAULT_REMINDER,
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
          .eq("habit_id", habitId)
          .eq("completed_date", today)
          .delete();
        show(`"${habit.title}" marked incomplete`, "info", Info);
      } else {
        await supabase
          .from("habit_completions")
          .insert({ habit_id: habitId, completed_date: today });
        show(`Great! "${habit.title}" completed 🎉`, "success", CheckCircle);
      }
    } catch (err) {
      console.error(err);
      show("Failed to sync habit", "error", AlertCircle);
      // Revert on error
      await fetchUserData(user.id);
    } finally {
      setSyncing(false);
    }
  };

  const addHabit = async (input) => {
    try {
      setSyncing(true);
      const data = await supabase.from("habits").insert({
        user_id: user.id,
        title: input.title,
        icon: input.icon,
        time_of_day: input.timeOfDay,
        notes: "",
      });

      // Add to local state
      setHabits((prev) => [
        ...prev,
        {
          id: data?.[0]?.id || uid(),
          title: input.title,
          icon: input.icon,
          timeOfDay: input.timeOfDay,
          notes: "",
          reminderSettings: DEFAULT_REMINDER,
          createdAt: today,
          completedDates: [],
          streak: 0,
        },
      ]);
      show(`"${input.title}" added to your routine`, "success", CheckCircle);
      return true;
    } catch (err) {
      console.error(err);
      if (err.code === "23505" || err.message?.includes("habits_user_id_title_key")) {
        show(`"${input.title}" already exists in your habits`, "error", AlertCircle);
      } else {
        show(`Failed to create habit: ${err.message}`, "error", AlertCircle);
      }
      return false;
    } finally {
      setSyncing(false);
    }
  };

  const deleteHabit = async (habitId) => {
    const habit = habits.find((h) => h.id === habitId);
    try {
      setSyncing(true);
      await supabase.from("habits").eq("id", habitId).delete();
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
      show(`"${habit.title}" deleted`, "info", Info);
    } catch (err) {
      console.error(err);
      show("Failed to delete habit", "error", AlertCircle);
    } finally {
      setSyncing(false);
    }
  };

  const saveHabitNote = async (habitId, text) => {
    try {
      setSyncing(true);
      await supabase.from("habits").eq("id", habitId).update({ notes: text });
      
      // Update local state
      setHabits((prev) =>
        prev.map((h) => (h.id === habitId ? { ...h, notes: text } : h))
      );
      show("Notes saved", "success", CheckCircle);
    } catch (err) {
      console.error(err);
      show("Failed to save note", "error", AlertCircle);
    } finally {
      setSyncing(false);
    }
  };

  const saveHabitReminder = async (habitId, reminderSettings) => {
    try {
      setSyncing(true);
      await supabase.from("habits").eq("id", habitId).update({ reminder_settings: reminderSettings });
      setHabits((prev) =>
        prev.map((h) => (h.id === habitId ? { ...h, reminderSettings } : h))
      );
      show("Reminder saved", "success", CheckCircle);
      return true;
    } catch (err) {
      console.error(err);
      show("Failed to save reminder", "error", AlertCircle);
      return false;
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

  const handleLogout = async () => {
    try {
      await supabase.logout();
      setUser(null);
      setHabits([]);
      setJournals({});
      show("Logged out successfully", "success", CheckCircle);
    } catch (err) {
      console.error(err);
      show("Failed to logout", "error", AlertCircle);
    }
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
      show("Journal saved", "success", CheckCircle);
    } catch (err) {
      console.error("Journal sync failed:", err);
      show("Journal save failed", "error", AlertCircle);
    } finally {
      setSyncing(false);
    }
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

  const selectedHabit = selectedHabitId ? habits.find(h => h.id === selectedHabitId) : null;

  return (
    <div className={`min-h-screen ${t.shell} flex justify-center relative`}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          icon={toast.icon}
          onClose={() => remove(toast.id)}
        />
      ))}
      
      <div className={`w-full max-w-md min-h-screen ${t.canvas} shadow-lg relative overflow-hidden`}>
        
        {/* --- Render Detail Screen if a habit is selected --- */}
        {selectedHabit && (
          <HabitDetailScreen 
            t={t} 
            habit={selectedHabit} 
            onClose={() => setSelectedHabitId(null)} 
            onSaveNote={saveHabitNote} 
            onSaveReminder={saveHabitReminder}
          />
        )}

        {/* --- Render Main Dashboard if NO habit is selected --- */}
        <div className={selectedHabit ? "hidden" : "block"}>
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
                  onOpenDetails={(id) => setSelectedHabitId(id)}
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
    </div>
  );
}
