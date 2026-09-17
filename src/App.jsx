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
  Camera,
  ChevronRight,
  Lock,
  Bell,
  Globe,
  Users,
  Search,
  Trophy,
  UserPlus,
  UserCheck,
  UserX,
  MessageCircle,
  Heart,
} from "lucide-react";

/* ---------------------------------------------------------------
   Supabase Setup
--------------------------------------------------------------- */

const SUPABASE_URL = "https://oymdanzmnpvfwzoawvua.supabase.co";
const VERIFICATION_PATH = "/email-verified";
const PRODUCTION_ORIGIN = "https://jourmalism.vercel.app";
const APP_ORIGIN = typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? window.location.origin
  : PRODUCTION_ORIGIN;
const APP_URL = `${APP_ORIGIN}${VERIFICATION_PATH}`;
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
    const responseText = await res.text();
    const data = responseText ? JSON.parse(responseText) : {};
    if (!res.ok) {
      const message = data.error_description || data.msg || data.message || `Request failed (HTTP ${res.status})`;
      throw new Error(message);
    }
    return data;
  }

  async signup(username, email, password) {
    const data = await this._authRequest("POST", `/signup?redirect_to=${encodeURIComponent(APP_URL)}`, {
      email,
      password,
      data: { username: username.toLowerCase() },
    });
    this.session = data.session;
    localStorage.setItem("sb-session", JSON.stringify(data.session));
    return data.user;
  }

  async login(email, password) {
    const loginEmail = email.includes("@")
      ? email
      : await this.lookupEmailByUsername(email);
    const data = await this._authRequest("POST", "/token?grant_type=password", {
      email: loginEmail,
      password,
    });
    this.session = data;
    localStorage.setItem("sb-session", JSON.stringify(data));
    return data.user;
  }

  async lookupEmailByUsername(username) {
    const result = await this._request("POST", "/rpc/get_email_by_username", { lookup_username: username.toLowerCase() });
    if (!result) throw new Error("Username not found");
    return result;
  }

  async searchProfiles(username) {
    return await this._request("POST", "/rpc/search_profiles", {
      search_username: username.toLowerCase(),
    });
  }

  async sendFriendRequest(userId) {
    return await this._request("POST", "/rpc/send_friend_request", { target_user_id: userId });
  }

  async getPendingFriendRequests() {
    return await this._request("POST", "/rpc/get_pending_friend_requests");
  }

  async respondFriendRequest(requestId, status) {
    return await this._request("POST", "/rpc/respond_friend_request", {
      request_id: requestId,
      next_status: status,
    });
  }

  async getFriends() {
    return await this._request("POST", "/rpc/get_friends");
  }

  async removeFriend(userId) {
    return await this._request("POST", "/rpc/remove_friend", { friend_user_id: userId });
  }

  async getCurrentHealth() {
    const result = await this._request("POST", "/rpc/get_current_health");
    return result?.[0] || { health_points: 100, missed_habits: 0 };
  }

  async updateUsername(userId, email, username) {
    return await this.from("profiles").upsert({ id: userId, email, username: username.toLowerCase() });
  }

  async getSession() {
    const stored = localStorage.getItem("sb-session");
    if (stored) {
      this.session = JSON.parse(stored);
      if (this.session.expires_at && this.session.expires_at * 1000 <= Date.now() + 60000) {
        const data = await this._authRequest("POST", "/token?grant_type=refresh_token", {
          refresh_token: this.session.refresh_token,
        });
        this.session = data;
        localStorage.setItem("sb-session", JSON.stringify(data));
      }
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

  async updateUser(attributes) {
    return await this._authRequestWithSession("PUT", "/user", attributes);
  }

  async deleteUser() {
    return await this._authRequestWithSession("DELETE", "/user");
  }

  async _authRequestWithSession(method, path, body = null) {
    const res = await fetch(`${this.url}/auth/v1${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: this.key,
        Authorization: `Bearer ${this.session?.access_token}`,
      },
      body: body ? JSON.stringify(body) : null,
    });
    const responseText = await res.text();
    const data = responseText ? JSON.parse(responseText) : null;
    if (!res.ok) throw new Error(data?.message || data?.error_description || `HTTP ${res.status}`);
    return data;
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

  async execute() {
    return await this._exec();
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
      let separator = "?";
      for (const f of this.query.filters) {
        if (f.type === "eq") {
          path += `${separator}${f.col}=eq.${encodeURIComponent(f.val)}`;
          separator = "&";
        }
      }
    }
    return await this.client._request("PATCH", path, data);
  }

  async delete() {
    let path = `/${this.name}`;
    if (this.query?.filters?.length) {
      let separator = "?";
      for (const f of this.query.filters) {
        if (f.type === "eq") {
          path += `${separator}${f.col}=eq.${encodeURIComponent(f.val)}`;
          separator = "&";
        }
      }
    }
    return await this.client._request("DELETE", path);
  }

  async upsert(data) {
    return await this.client._request("POST", `/${this.name}?on_conflict=id`, data);
  }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_KEY);

function getAuthErrorMessage(error, isSignup) {
  const rawMessage = error?.message || "";
  if (/rate limit|too many requests|email rate/i.test(rawMessage)) {
    return isSignup
      ? "Verification email limit reached. Please wait a few minutes before trying again, or check your inbox and spam folder for an existing email."
      : "Too many sign-in attempts. Please wait a few minutes and try again.";
  }
  return rawMessage || (isSignup
    ? "Unable to create your account. Please check your details and try again."
    : "Unable to sign in. Please check your details and try again.");
}

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
  const [saveMessage, setSaveMessage] = useState(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const reminder = { ...DEFAULT_REMINDER, ...(habit.reminderSettings || {}) };
  const reminderSummary = reminder.frequency === "every day"
    ? `Every day at ${reminder.hour}:${reminder.minute} ${reminder.period}`
    : `${reminder.activeDays?.filter(Boolean).join(", ") || "Selected days"} at ${reminder.hour}:${reminder.minute} ${reminder.period}`;
  const streakActive = habit.streak >= 2;
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
    const saved = await onSaveNote(habit.id, note);
    setSaveMessage(saved
      ? { message: "Notes saved", type: "success", icon: CheckCircle }
      : { message: "Failed to save note", type: "error", icon: AlertCircle });
    setSaving(false);
  };

  return (
    <div className={`min-h-screen ${t.canvas} flex flex-col absolute inset-0 z-50 animate-[slideIn_0.2s_ease-out]`}>
      <style>{`@keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
      {saveMessage && (
        <Toast
          message={saveMessage.message}
          type={saveMessage.type}
          icon={saveMessage.icon}
          onClose={() => setSaveMessage(null)}
        />
      )}

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
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${streakActive ? "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300" : `${t.badge} ${t.textMuted}`}`}>
              <Flame size={13} fill={streakActive ? "currentColor" : "none"} /> {streakActive ? "Active Streak" : "Streak Off"}
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

const loginSuccessCats = [
  { image: "/1.png", message: "Hallow, welcome back!" },
  { image: "/2.png", message: "Sup brodie!" },
  { image: "/3.png", message: "hehehe, lollipop hehe" },
];

function LoginSuccessCat({ cat, onDone }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 h-[min(52vh,460px)] overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes homeCatPopUp { 0% { opacity: 0; transform: translate(-50%, 100%); } 22% { opacity: 1; transform: translate(-50%, 0); } 73% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, 8%); } }
        @keyframes homeBubblePopUp { 0%, 18% { opacity: 0; transform: translate(-50%, 12px) scale(0.88); } 27%, 73% { opacity: 1; transform: translate(-50%, 0) scale(1); } 100% { opacity: 0; transform: translate(-50%, -5px) scale(0.96); } }
        @media (prefers-reduced-motion: reduce) { .home-cat-animation, .home-bubble-animation { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; } }
      `}</style>
      <div
        className="home-cat-animation absolute bottom-[-1px] left-1/2 w-[150px] sm:w-[150px] lg:w-[100px]"
        onAnimationEnd={onDone}
        style={{ animation: "homeCatPopUp 5.5s cubic-bezier(0.22, 0.8, 0.35, 1) forwards" }}
      >
        <div
          className="home-bubble-animation absolute bottom-[96%] left-1/2 max-w-[calc(100vw-2rem)] whitespace-nowrap rounded-full bg-slate-900 px-5 py-2.5 text-center text-sm font-semibold text-white shadow-lg"
          style={{ animation: "homeBubblePopUp 5.5s ease-out forwards" }}
        >
          {cat.message}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[8px] border-x-transparent border-t-[8px] border-t-slate-900" />
        </div>
        <img src={cat.image} alt="" className="block h-auto w-full object-contain" />
      </div>
    </div>
  );
}

function AccountSettings({ t, user, language, onLanguageChange, onUpdateProfile, onUpdateUsername, onDeleteAccount, onLogout, onClose }) {
  const [username, setUsername] = useState(user?.user_metadata?.username || user?.email?.split("@")[0] || "user");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [message, setMessage] = useState(null);
  const fileRef = useRef(null);
  const avatarUrl = user?.user_metadata?.avatar_url;
  const displayName = user?.user_metadata?.username || user?.email?.split("@")[0] || "User";

  const notify = (text, type = "success") => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage(null), 3500);
  };

  const handleAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setSavingAvatar(true);
      const avatar = await compressImage(file);
      await onUpdateProfile({ data: { avatar_url: avatar } });
      notify(language === "id" ? "Foto profil diperbarui" : "Profile photo updated");
    } catch (err) {
      notify(err.message || "Failed to update profile photo", "error");
    } finally {
      setSavingAvatar(false);
      event.target.value = "";
    }
  };

  const handlePassword = async (event) => {
    event.preventDefault();
    if (password.length < 6) {
      notify(language === "id" ? "Password minimal 6 karakter" : "Password must be at least 6 characters", "error");
      return;
    }
    if (password !== confirmPassword) {
      notify(language === "id" ? "Konfirmasi password tidak cocok" : "Passwords do not match", "error");
      return;
    }
    try {
      setSavingPassword(true);
      await onUpdateProfile({ password });
      setPassword("");
      setConfirmPassword("");
      notify(language === "id" ? "Password diperbarui" : "Password updated");
    } catch (err) {
      notify(err.message || "Failed to update password", "error");
    } finally {
      setSavingPassword(false);
    }
  };

  const english = language === "en";
  const text = english
    ? { title: "Account Settings", changePhoto: "Tap to change photo", preferences: "PREFERENCES & SECURITY", username: "Username", usernameHint: "This is how others identify you", saveUsername: "Save username", password: "Change Password", passwordHint: "Use at least 6 characters", newPassword: "New password", confirm: "Confirm password", notifications: "Notifications", language: "Language", account: "ACCOUNT MANAGEMENT", delete: "Delete Account", deleteHint: "Permanently erase data", logout: "Log Out", updated: "Updated now" }
    : { title: "Pengaturan Akun", changePhoto: "Ketuk untuk mengganti foto", preferences: "PREFERENSI & KEAMANAN", username: "Username", usernameHint: "Nama yang digunakan untuk identitas", saveUsername: "Simpan username", password: "Ganti Password", passwordHint: "Gunakan minimal 6 karakter", newPassword: "Password baru", confirm: "Konfirmasi password", notifications: "Notifikasi", language: "Bahasa", account: "MANAJEMEN AKUN", delete: "Hapus Akun", deleteHint: "Hapus data secara permanen", logout: "Keluar", updated: "Diperbarui sekarang" };

  const handleUsername = async (event) => {
    event.preventDefault();
    const nextUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(nextUsername)) {
      notify(english ? "Use 3-24 letters, numbers, or underscores" : "Gunakan 3-24 huruf, angka, atau garis bawah", "error");
      return;
    }
    try {
      await onUpdateUsername(nextUsername);
      setUsername(nextUsername);
      notify(english ? "Username updated" : "Username diperbarui");
    } catch (err) {
      const isUsernameConflict = err.code === "23505"
        || err.message?.includes("profiles_pkey")
        || err.message?.includes("profiles_username_key")
        || err.message?.toLowerCase().includes("duplicate key");
      notify(
        isUsernameConflict
          ? (english ? "This username is already taken. Please choose another." : "Username ini sudah digunakan. Silakan pilih username lain.")
          : (err.message || (english ? "Failed to update username" : "Username gagal diperbarui")),
        "error"
      );
    }
  };

  return (
    <div className={`min-h-screen ${t.canvas} absolute inset-0 z-50 overflow-y-auto`}>
      {message && (
        <Toast message={message.text} type={message.type} icon={message.type === "error" ? AlertCircle : CheckCircle} onClose={() => setMessage(null)} />
      )}
      <div className="px-5 pt-5 pb-10">
        <div className="flex items-center justify-center relative mb-7">
          <button onClick={onClose} aria-label="Back" className={`absolute left-0 w-9 h-9 rounded-full border ${t.border} ${t.card} flex items-center justify-center ${t.textPrimary}`}>
            <ArrowLeft size={18} />
          </button>
          <h1 className={`text-base font-bold ${t.textPrimary}`}>{text.title}</h1>
        </div>

        <div className="text-center mb-8">
          <button onClick={() => fileRef.current?.click()} disabled={savingAvatar} className="relative inline-flex group">
            <div className={`w-24 h-24 rounded-full overflow-hidden flex items-center justify-center ${t.card} border-2 ${t.border} shadow-sm`}>
              {avatarUrl ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" /> : <User size={42} className={t.textPrimary} fill="currentColor" strokeWidth={1} />}
            </div>
            <span className="absolute right-0 bottom-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center border-2 border-white">
              {savingAvatar ? <Loader size={15} className="animate-spin" /> : <Camera size={15} />}
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
          <p className="text-xs font-semibold text-blue-600 mt-2">{text.changePhoto}</p>
          <h2 className={`text-lg font-bold ${t.textPrimary} mt-4`}>{displayName}</h2>
          <p className={`text-xs ${t.textMuted} mt-1`}>{user?.email}</p>
        </div>

        <p className={`text-[11px] font-bold tracking-wide ${t.textMuted} mb-2 px-2`}>{text.preferences}</p>
        <div className={`${t.card} border ${t.border} rounded-2xl overflow-hidden mb-7`}>
          <form onSubmit={handleUsername} className={`p-4 border-b ${t.border}`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><User size={17} /></span>
              <div><p className={`text-sm font-medium ${t.textPrimary}`}>{text.username}</p><p className={`text-[11px] ${t.textMuted}`}>{text.usernameHint}</p></div>
            </div>
            <div className="flex gap-2">
              <input type="text" value={username} onChange={(event) => setUsername(event.target.value.replace(/\s/g, ""))} className={`min-w-0 flex-1 rounded-xl ${t.inputBg} border ${t.border} px-3 py-2.5 text-sm ${t.textPrimary} outline-none focus:border-blue-500`} />
              <button type="submit" className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white">{text.saveUsername}</button>
            </div>
          </form>
          <form onSubmit={handlePassword} className={`p-4 border-b ${t.border}`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Lock size={17} /></span>
              <div><p className={`text-sm font-medium ${t.textPrimary}`}>{text.password}</p><p className={`text-[11px] ${t.textMuted}`}>{text.passwordHint}</p></div>
            </div>
            <div className="grid gap-2">
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={text.newPassword} className={`w-full rounded-xl ${t.inputBg} border ${t.border} px-3 py-2.5 text-sm ${t.textPrimary} outline-none focus:border-blue-500`} />
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={text.confirm} className={`w-full rounded-xl ${t.inputBg} border ${t.border} px-3 py-2.5 text-sm ${t.textPrimary} outline-none focus:border-blue-500`} />
              <button type="submit" disabled={savingPassword || !password} className="justify-self-end rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{savingPassword ? "Saving..." : "Save password"}</button>
            </div>
          </form>
          <div className={`flex items-center gap-3 p-4 border-b ${t.border}`}>
            <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Bell size={17} /></span>
            <span className={`text-sm ${t.textPrimary} flex-1`}>{text.notifications}</span>
            <span className="w-9 h-5 rounded-full bg-blue-600 relative"><span className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-white" /></span>
          </div>
          <div className="flex items-center gap-3 p-4">
            <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Globe size={17} /></span>
            <span className={`text-sm ${t.textPrimary} flex-1`}>{text.language}</span>
            <select value={language} onChange={(event) => onLanguageChange(event.target.value)} className={`bg-transparent text-xs ${t.textMuted} outline-none`}>
              <option value="en">English</option>
              <option value="id">Bahasa Indonesia</option>
            </select>
          </div>
        </div>

        <p className={`text-[11px] font-bold tracking-wide ${t.textMuted} mb-2 px-2`}>{text.account}</p>
        <div className={`${t.card} border ${t.border} rounded-2xl overflow-hidden mb-7`}>
          <button onClick={onDeleteAccount} className="w-full flex items-center gap-3 p-4 text-left">
            <span className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center"><Trash2 size={17} /></span>
            <span className="flex-1"><span className="block text-sm text-red-500">{text.delete}</span><span className={`block text-[11px] ${t.textMuted}`}>{text.deleteHint}</span></span>
            <ChevronRight size={17} className={t.textMuted} />
          </button>
        </div>
        <button onClick={onLogout} className="w-full rounded-2xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-500 flex items-center justify-center gap-2"><LogOut size={16} />{text.logout}</button>
      </div>
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

function StartingScreen({ t, onGetStarted, onSignIn }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className={`min-h-screen ${t.canvas} flex items-center justify-center px-4 py-10 sm:px-8 lg:px-12`}>
      <style>{`@keyframes floatBubble { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -9px); } }`}</style>
      <div className="w-full max-w-5xl grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="relative flex min-h-[300px] items-center justify-center sm:min-h-[380px]">
          <div className="absolute top-16 left-1/2 z-10 rounded-full bg-slate-900 text-white text-xs px-4 py-2 shadow-lg" style={{ animation: "floatBubble 3.4s ease-in-out infinite" }}>
            Siap Jadi Sigma?
            <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[8px] border-x-transparent border-t-[8px] border-t-slate-900" />
          </div>
          <div className="flex h-64 w-64 items-center justify-center overflow-hidden rounded-full bg-blue-50/80 sm:h-80 sm:w-80">
            {!imageFailed ? (
              <img src="/cat.png" alt="A cat ready to build habits" onError={() => setImageFailed(true)} className="w-[88%] h-[88%] object-contain" />
            ) : (
              <div className="text-center text-slate-400 text-sm px-8">Add the cat PNG as <strong>/cat.png</strong></div>
            )}
          </div>
        </div>

        <div className="w-full max-w-xl justify-self-center px-1 lg:justify-self-start">
          <h1 className="text-4xl font-extrabold leading-[0.98] tracking-tight text-slate-950 sm:text-5xl">Small habits<br />Big changes<span className="text-blue-600">.</span></h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-500 sm:text-lg">Train your daily focus, track your fitness streaks, and master your life one rep at a time using <strong>JOURMAL.</strong></p>
          <button onClick={onGetStarted} className="mt-9 h-14 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-600/25 sm:max-w-md">Get Started <span className="ml-2 text-lg">→</span></button>
          <p className="text-center text-sm text-slate-500 mt-4">Already have an account? <button onClick={onSignIn} className="font-bold text-blue-600">Sign In</button></p>
        </div>
      </div>
    </div>
  );
}

function LegacyLoginScreen({ t, onLoginSuccess, initialMode = "choose" }) {
  const [mode, setMode] = useState(initialMode); // "choose" | "login" | "signup" | "verify"
  const [username, setUsername] = useState("");
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
        await supabase.signup(username, email, password);
        show(`Verification email sent to ${email}`, "success", CheckCircle);
        setMode("verify");
        setUsername("");
        setEmail("");
        setPassword("");
      } else {
        await supabase.login(email, password);
        const user = await supabase.getUser();
        if (user) {
          onLoginSuccess(user);
        }
      }
    } catch (err) {
      const message = err?.message || "Unable to create your account. Please check your details and try again.";
      setError(message);
      show(message, "error", AlertCircle);
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
            <h1 className={`text-3xl font-bold ${t.textPrimary} mb-2`}>Jourmal</h1>
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
                setUsername("");
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
                setUsername("");
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
            {isSignup ? "Join Jourmal" : "Welcome back"}
          </h1>
          <p className={`text-sm ${t.textSecondary}`}>
            {isSignup
              ? "Track habits with your friends"
              : "Pick up where you left off"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <div>
              <label className={`text-xs font-semibold tracking-wide ${t.textMuted} mb-2 block uppercase`}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                placeholder="yourusername"
                required
                autoFocus
                className={`w-full rounded-xl px-3.5 py-3 text-sm ${t.inputBg} border ${t.inputBorder} ${t.textPrimary} outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className={`text-xs font-semibold tracking-wide ${t.textMuted} mb-2 block uppercase`}>
              {isSignup ? "Email" : "Email / Username"}
            </label>
            <input
              type={isSignup ? "email" : "text"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isSignup ? "you@example.com" : "Email or username"}
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

function LoginScreen({ t, onLoginSuccess, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode === "signup" ? "signup" : "login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { toasts, show, remove } = useToast();
  const isSignup = mode === "signup";

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignup) {
        await supabase.signup(username, email, password);
        show(`Verification email sent to ${email}`, "success", CheckCircle);
      } else {
        await supabase.login(email, password);
        const user = await supabase.getUser();
        if (user) onLoginSuccess(user);
      }
    } catch (err) {
      const message = getAuthErrorMessage(err, isSignup);
      setError(message);
      show(message, "error", AlertCircle);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
      <style>{`
        @keyframes authPanelIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes authFieldIn { from { opacity: 0; max-height: 0; transform: translateY(-8px); } to { opacity: 1; max-height: 100px; transform: translateY(0); } }
      `}</style>
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} icon={toast.icon} onClose={() => remove(toast.id)} />
      ))}
      <div className="w-full max-w-lg">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 mx-auto flex items-center justify-center overflow-hidden shadow-sm">
            <img src="/cat.png" alt="Jourmal" className="w-full h-full object-cover" />
          </div>
          <h1 className="mt-4 text-[28px] leading-none font-extrabold tracking-tight text-slate-900">Jourmal<span className="text-blue-600">.</span></h1>
          <p className="mt-3 text-sm leading-5 text-slate-500">Build habits, track progress, reflect<br />daily</p>
        </div>

        <div className="relative mt-7 h-12 rounded-2xl bg-slate-100 p-1 flex">
          <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-white shadow-sm transition-transform duration-300 ease-out ${isSignup ? "translate-x-full" : "translate-x-0"}`} />
          <button type="button" onClick={() => switchMode("login")} className={`relative z-10 w-1/2 text-sm font-semibold transition-colors duration-300 ${!isSignup ? "text-slate-900" : "text-slate-500"}`}>Sign In</button>
          <button type="button" onClick={() => switchMode("signup")} className={`relative z-10 w-1/2 text-sm font-semibold transition-colors duration-300 ${isSignup ? "text-slate-900" : "text-slate-500"}`}>Create Account</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-8">
          <div className="space-y-4" style={{ animation: "authPanelIn 0.35s ease-out" }}>
            {isSignup && (
              <div style={{ animation: "authFieldIn 0.3s ease-out" }}>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Username</label>
                <input type="text" value={username} onChange={(event) => setUsername(event.target.value.replace(/\s/g, ""))} placeholder="yourusername" required className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">{isSignup ? "Email address" : "Email / Username"}</label>
              <input type={isSignup ? "email" : "text"} value={email} onChange={(event) => setEmail(event.target.value)} placeholder={isSignup ? "you@example.com" : "you@example.com or username"} required autoFocus className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700">Password</label>
                {!isSignup && <button type="button" className="text-xs font-semibold text-blue-600">Forgot password?</button>}
              </div>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSignup ? "At least 8 characters" : "••••••••••••"} required className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 pr-12 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{showPassword ? "Hide" : "Show"}</button>
              </div>
            </div>
          </div>

          {error && <div className="mt-4 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-xs font-medium text-red-600">{error}</div>}
          <button type="submit" disabled={loading} className="mt-7 w-full h-14 rounded-2xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all duration-200 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60">
            {loading && <Loader size={15} className="animate-spin" />}
            {isSignup ? "Create account" : "Sign in"}<span className="text-lg">→</span>
          </button>
        </form>

        <div className="mt-7 pt-5 border-t border-slate-200 text-center text-xs text-slate-500">
          {isSignup ? <>Already have an account? <button type="button" onClick={() => switchMode("login")} className="font-bold text-blue-600">Sign In</button></> : <>Don't have an account? <button type="button" onClick={() => switchMode("signup")} className="font-bold text-blue-600">Create account</button></>}
          <div className="mt-5 pt-4 border-t border-slate-100 text-[11px] leading-5 text-slate-400">◉ &nbsp; Verification email required.<br />We'll send a confirmation link to verify your identity.</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Header
--------------------------------------------------------------- */

function Header({ t, isDark, onToggleTheme, completedCount, totalCount, user, onLogout, onProfileClick, onOpenSocial, socialNotification, health }) {
  const pct = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  // Extract the username from the email to display "Hi, [Name]!"
  const rawName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  return (
    <div className="px-5 pt-8 pb-4">
      {/* Top Profile & Actions Row */}
      <div className="flex items-center justify-between mb-6">
        
        {/* User Info */}
        <div className="flex items-center gap-3.5">
          <button onClick={onProfileClick} aria-label="Open account settings" className={`relative w-[52px] h-[52px] rounded-full overflow-visible flex items-center justify-center ${t.card} shrink-0 shadow-sm border ${t.border}`}>
            {user?.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="Profile" className="h-full w-full rounded-full object-cover" /> : <User size={26} className={t.textPrimary} fill="currentColor" strokeWidth={1} />}
            <span className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full bg-blue-600 text-white border-2 border-white flex items-center justify-center shadow-sm">
              <PenLine size={10} strokeWidth={2.5} />
            </span>
          </button>
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

      <div className="mt-1 flex items-center gap-3 px-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[11px] font-bold">
          <Heart size={13} className="text-red-500" fill="currentColor" />
          <span className={t.textPrimary}>HP</span>
          <div className={`h-3 flex-1 overflow-hidden rounded-full ${t.track}`}>
            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${health.health_points}%` }} />
          </div>
          <span className={t.textPrimary}>{health.health_points}</span>
        </div>
        <button
          onClick={onOpenSocial}
          aria-label="Open social"
          className="relative flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/25 transition-all duration-200 active:scale-95 hover:bg-blue-700"
        >
          <Users size={19} strokeWidth={2.5} />
          <span className="mt-1 text-[10px] font-bold tracking-tight">SOCIAL</span>
          <span className={`absolute right-2 top-2 h-2 w-2 rounded-full ${socialNotification ? "bg-green-300" : "bg-blue-300"}`} />
        </button>
      </div>
    </div>
  );
}

function EmailVerifiedScreen({ email, onGoToDashboard }) {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-5 sm:flex sm:items-center sm:justify-center sm:px-6">
      <div className="relative flex min-h-[calc(100vh-2.5rem)] w-full max-w-[640px] flex-col items-center rounded-[42px] border border-slate-200 bg-white px-6 py-12 shadow-[0_20px_60px_rgba(38,64,96,0.12)] sm:min-h-[820px] sm:px-10">
        <div className="flex h-44 w-44 items-center justify-center rounded-full border-8 border-blue-100 bg-blue-50 shadow-sm sm:h-52 sm:w-52">
          <img src="/download (3) 4.png" alt="Jourmal verification" className="h-full w-full rounded-full object-cover" />
        </div>
        <div className="mt-[-22px] flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-emerald-500 text-white shadow-lg">
          <Check size={30} strokeWidth={4} />
        </div>
        <p className="mt-3 text-xl font-extrabold tracking-[0.16em] text-slate-400">JOURMAL<span className="text-blue-600">.</span></p>

        <div className="mt-16 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[26px] bg-emerald-500 text-white shadow-[0_12px_28px_rgba(16,185,129,0.35)]">
            <Check size={52} strokeWidth={3.5} />
          </div>
          <h1 className="mt-12 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Email Verified!</h1>
          <p className="mx-auto mt-4 max-w-md text-lg leading-8 text-slate-500">Your account is confirmed and fully activated.<br />You are ready to start building atomic daily habits.</p>
        </div>

        <div className="mt-10 w-full max-w-[540px] rounded-[26px] border border-slate-200 bg-slate-50 p-6">
          <div className="flex items-center gap-4 border-b border-slate-200 pb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><span className="text-xl">✉</span></div>
            <div className="min-w-0 flex-1"><p className="text-sm text-slate-400">Confirmed Account</p><p className="truncate text-lg font-bold text-slate-800">{email || "Your account"}</p></div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-600">✓ Verified</span>
          </div>
          <div className="flex items-center gap-3 py-5 text-base text-slate-600"><span className="h-3 w-3 rounded-full bg-emerald-500" />Status: Active &amp; Ready<span className="ml-auto rounded-xl bg-blue-50 px-3 py-2 font-bold text-blue-600">Day 1 Streak</span></div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-500"><strong className="text-slate-700">What's next thou ask?</strong> Add your first habit today to establish your routine before midnight!</div>
        </div>

        <div className="mt-auto w-full max-w-[540px] pt-12 text-center">
          <button onClick={onGoToDashboard} className="h-16 w-full rounded-2xl bg-blue-600 text-lg font-bold text-white shadow-[0_12px_24px_rgba(37,99,235,0.25)] transition hover:bg-blue-700 active:scale-[0.99]">Go to Dashboard <span className="ml-2 text-2xl">→</span></button>
          <p className="mt-5 text-base text-slate-400">Need assistance? <span className="text-blue-600">Contact support</span></p>
          <div className="mx-auto mt-8 h-1.5 w-40 rounded-full bg-slate-300" />
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

function HabitCard({ t, habit, onToggle, onDelete, onEdit, onOpenDetails }) {
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
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(habit);
              }}
              aria-label={`Edit ${habit.title}`}
              className={`w-7 h-7 rounded-full flex items-center justify-center ${t.textMuted} hover:${t.textPrimary} hover:${t.badge}`}
            >
              <MoreVertical size={15} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(habit.id);
              }}
              aria-label={`Delete ${habit.title}`}
              className={`w-7 h-7 rounded-full flex items-center justify-center ${t.textMuted} hover:text-red-500`}
            >
              <Trash2 size={14} />
            </button>
          </div>
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
          e.stopPropagation();
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

function AddHabitSheet({ t, open, editingHabit, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("morning");
  const [icon, setIcon] = useState("Droplet");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  

  useEffect(() => {
    if (open) {
      setTitle(editingHabit?.title || "");
      setTimeOfDay(editingHabit?.timeOfDay || "morning");
      setIcon(editingHabit?.icon || "Droplet");
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [open, editingHabit]);

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
          <h2 className={`text-lg font-semibold ${t.textPrimary}`}>{editingHabit ? "Edit habit" : "New habit"}</h2>
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
          {loading ? "Saving..." : editingHabit ? "Save changes" : "Save habit"}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   App
--------------------------------------------------------------- */

function censorEmail(value = "") {
  const [localPart, domain] = value.split("@");
  if (!localPart) return "";

  const censoredLocal = `${localPart[0]}${"*".repeat(Math.max(localPart.length - 3, 1))}${localPart.slice(-2)}`;
  if (!domain) return censoredLocal;

  return `${censoredLocal}${"*".repeat(Math.max(domain.length - 3, 1))}${domain.slice(-3)}`;
}

function SocialScreen({ t, user, habits, onClose, onNotificationChange }) {
  const [section, setSection] = useState("leaderboard");
  const [friendView, setFriendView] = useState("all");
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);

  useEffect(() => {
    onNotificationChange(requests.length > 0);
  }, [requests.length, onNotificationChange]);

  useEffect(() => {
    let cancelled = false;
    const loadSocialData = async () => {
      try {
        const [pendingRequests, friendProfiles] = await Promise.all([
          supabase.getPendingFriendRequests(),
          supabase.getFriends(),
        ]);
        if (cancelled) return;
        setRequests((pendingRequests || []).map((request) => ({
          id: request.id,
          userId: request.sender_id,
          name: request.sender_username,
          username: request.sender_username,
          color: "blue",
        })));
        const friendsWithEmails = await Promise.all((friendProfiles || []).map(async (friend) => {
          let email = friend.email;
          if (!email) {
            try {
              email = await supabase.lookupEmailByUsername(friend.username);
            } catch {
              email = "";
            }
          }
          return { ...friend, email };
        }));
        if (cancelled) return;
        setFriends(friendsWithEmails.map((friend) => ({
          id: friend.id,
          name: friend.username,
          username: friend.username,
          email: friend.email,
          streak: 0,
          online: false,
          color: "blue",
        })));
      } catch (error) {
        console.error("Failed to load social data:", error);
      }
    };

    loadSocialData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const search = async () => {
      const normalizedQuery = query.trim().replace(/^@/, "");
      if (!normalizedQuery) {
        setSearchResult(null);
        return;
      }

      setSearching(true);
      try {
        const results = await supabase.searchProfiles(normalizedQuery);
        const match = results?.find((profile) => profile.id !== user?.id);
        if (!cancelled) setSearchResult(match ? {
          id: match.id,
          name: match.username,
          username: match.username,
          color: "blue",
        } : null);
      } catch (error) {
        console.error("Failed to search profiles:", error);
        if (!cancelled) setSearchResult(null);
      } finally {
        if (!cancelled) setSearching(false);
      }
    };

    search();
    return () => {
      cancelled = true;
    };
  }, [query, user?.id]);

  const displayName = user?.user_metadata?.username || user?.email?.split("@")[0] || "You";
  const currentStreak = habits.length ? Math.max(...habits.map((habit) => habit.streak || 0)) : 0;
  const currentUser = { id: "me", name: displayName, username: displayName.toLowerCase(), email: user?.email, streak: currentStreak, online: true, color: "blue" };
  const leaderboard = [currentUser, ...friends]
    .sort((first, second) => second.streak - first.streak)
    .map((person, index) => ({ ...person, rank: index + 1 }));
  const filteredFriends = friends.filter((friend) => friend.online || friendView === "all");
  const avatarClass = {
    blue: "bg-blue-100 text-blue-600",
    violet: "bg-violet-100 text-violet-600",
    emerald: "bg-emerald-100 text-emerald-600",
    slate: "bg-slate-200 text-slate-600",
  };
  const isSearchResultFriend = searchResult && friends.some((friend) =>
    friend.id === searchResult.id
    || friend.username?.toLowerCase() === searchResult.username?.toLowerCase()
  );

  const handleRequest = async (person) => {
    try {
      await supabase.sendFriendRequest(person.id);
      setSentRequests((current) => [...current, person.id]);
    } catch (error) {
      console.error("Failed to send friend request:", error);
    }
  };

  const handleRespond = async (requestId, status) => {
    try {
      await supabase.respondFriendRequest(requestId, status);
      setRequests((current) => current.filter((request) => request.id !== requestId));
      if (status === "accepted") {
        const acceptedRequest = requests.find((request) => request.id === requestId);
        if (acceptedRequest) {
          setFriends((current) => [...current, {
            id: acceptedRequest.userId,
            name: acceptedRequest.name,
            username: acceptedRequest.username,
            streak: 0,
            online: false,
            color: "blue",
          }]);
        }
      }
    } catch (error) {
      console.error("Failed to respond to friend request:", error);
    }
  };

  const handleUnfriend = async (friend) => {
    try {
      await supabase.removeFriend(friend.id);
      setFriends((current) => current.filter((item) => item.id !== friend.id));
    } catch (error) {
      console.error("Failed to remove friend:", error);
    }
  };

  return (
    <div className={`absolute inset-0 z-50 min-h-screen ${t.canvas} overflow-y-auto`}>
      <div className="px-5 pb-10 pt-5">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Users size={20} /></div>
            <div><h1 className={`text-xl font-bold ${t.textPrimary}`}>Konco</h1><p className={`text-[11px] ${t.textMuted}`}>Your habit community</p></div>
          </div>
          <button onClick={onClose} aria-label="Close Konco" className={`flex h-9 w-9 items-center justify-center rounded-full ${t.badge} ${t.textMuted}`}><X size={17} /></button>
        </div>

        <div className={`mb-5 grid grid-cols-2 rounded-2xl ${t.badge} p-1`}>
          {[{ key: "leaderboard", label: "Leaderboard", icon: Trophy }, { key: "friends", label: `Friends (${friends.length})`, icon: Users }].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setSection(key)} className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-colors ${section === key ? "bg-blue-600 text-white shadow-sm" : t.textSecondary}`}><Icon size={14} />{label}</button>
          ))}
        </div>

        {section === "leaderboard" ? (
          <>
            <div className={`mb-5 grid grid-cols-3 gap-2 rounded-2xl ${t.card} border ${t.border} p-3 text-center`}>
              <div><p className={`text-[10px] uppercase ${t.textMuted}`}>Members</p><p className={`mt-1 text-lg font-bold ${t.textPrimary}`}>{leaderboard.length}</p></div>
              <div><p className={`text-[10px] uppercase ${t.textMuted}`}>Your rank</p><p className="mt-1 text-lg font-bold text-blue-600">#{currentUser.rank || leaderboard.findIndex((person) => person.id === "me") + 1}</p></div>
              <div><p className={`text-[10px] uppercase ${t.textMuted}`}>Live streak</p><p className="mt-1 text-lg font-bold text-orange-500">{currentStreak}d</p></div>
            </div>
            <div className="mb-3 flex items-center justify-between"><div><h2 className={`text-sm font-bold ${t.textPrimary}`}>All competitors</h2><p className={`text-[11px] ${t.textMuted}`}>Live streak data from the community</p></div><span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />LIVE</span></div>
            <div className="space-y-2">
              {leaderboard.map((person) => (
                <div key={person.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${person.id === "me" ? "border-blue-200 bg-blue-50/70" : `${t.card} ${t.border}`}`}>
                  <span className={`w-6 text-center text-xs font-bold ${person.rank <= 3 ? "text-amber-500" : t.textMuted}`}>{person.rank <= 3 ? ["🥇", "🥈", "🥉"][person.rank - 1] : `#${person.rank}`}</span>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ${avatarClass[person.color]}`}>{person.name.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1"><p className={`truncate text-sm font-bold ${t.textPrimary}`}>{person.name}{person.id === "me" && <span className="ml-1 text-[10px] text-blue-600">(You)</span>}</p><p className={`truncate text-[11px] ${t.textMuted}`}>{censorEmail(person.email || person.username)}</p></div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-xs font-bold text-orange-500"><Flame size={12} fill="currentColor" />{person.streak}d</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className={`mb-4 flex items-center gap-2 rounded-xl ${t.card} border ${t.border} px-3`}><Search size={16} className={t.textMuted} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search username or @email..." className={`min-w-0 flex-1 bg-transparent py-3 text-xs ${t.textPrimary} outline-none`} /><button onClick={() => searchResult && !isSearchResultFriend && handleRequest(searchResult)} disabled={!searchResult || searching || isSearchResultFriend || sentRequests.includes(searchResult?.id)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{searching ? "Searching..." : isSearchResultFriend ? "Friend" : searchResult && sentRequests.includes(searchResult.id) ? "Sent" : <><Plus size={13} className="mr-1 inline" />Add</>}</button></div>
            {query && searchResult && <div className={`mb-4 flex items-center gap-3 rounded-2xl border ${t.border} ${t.card} p-3`}><span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${avatarClass[searchResult.color]}`}>{searchResult.name.slice(0, 2).toUpperCase()}</span><div className="flex-1"><p className={`text-sm font-bold ${t.textPrimary}`}>{searchResult.name}</p><p className={`text-[11px] ${t.textMuted}`}>@{searchResult.username}</p></div><button onClick={() => !isSearchResultFriend && handleRequest(searchResult)} disabled={isSearchResultFriend || sentRequests.includes(searchResult.id)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{isSearchResultFriend ? "Friend" : sentRequests.includes(searchResult.id) ? "Request sent" : "Add friend"}</button></div>}
            <div className="mb-2 flex items-center justify-between"><h2 className={`text-[11px] font-bold uppercase tracking-wide ${t.textMuted}`}>Friend requests <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] text-white">{requests.length}</span></h2></div>
            <div className="mb-5 space-y-2">{requests.length === 0 ? <p className={`rounded-2xl border ${t.border} ${t.card} p-4 text-center text-xs ${t.textMuted}`}>No friend requests yet.</p> : requests.map((request) => <div key={request.id} className={`flex items-center gap-3 rounded-2xl border ${t.border} ${t.card} p-3`}><span className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ${avatarClass[request.color]}`}>{request.name.slice(0, 2).toUpperCase()}</span><div className="min-w-0 flex-1"><p className={`truncate text-sm font-bold ${t.textPrimary}`}>{request.name}</p><p className={`truncate text-[11px] ${t.textMuted}`}>@{request.username}</p></div><button onClick={() => handleRespond(request.id, "accepted")} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"><UserCheck size={13} className="mr-1 inline" />Accept</button><button onClick={() => handleRespond(request.id, "rejected")} aria-label={`Reject ${request.name}`} className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.badge} ${t.textMuted}`}><UserX size={14} /></button></div>)}</div>
            <div className="mb-2 flex items-center justify-between"><h2 className={`text-[11px] font-bold uppercase tracking-wide ${t.textMuted}`}>All friends</h2><div className={`flex rounded-lg ${t.badge} p-0.5 text-[10px] font-bold`}><button onClick={() => setFriendView("all")} className={`rounded-md px-2 py-1 ${friendView === "all" ? "bg-slate-900 text-white" : t.textMuted}`}>All ({friends.length})</button><button onClick={() => setFriendView("online")} className={`rounded-md px-2 py-1 ${friendView === "online" ? "bg-slate-900 text-white" : t.textMuted}`}>Online ({friends.filter((friend) => friend.online).length})</button></div></div>
            <div className="space-y-2">{filteredFriends.length === 0 ? <p className={`rounded-2xl border ${t.border} ${t.card} p-4 text-center text-xs ${t.textMuted}`}>{query ? "No users found." : "No friends yet."}</p> : filteredFriends.map((friend) => <div key={friend.id} className={`flex items-center gap-3 rounded-2xl border ${t.border} ${t.card} p-3`}><div className="relative"><span className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ${avatarClass[friend.color]}`}>{friend.name.slice(0, 2).toUpperCase()}</span>{friend.online && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />}</div><div className="min-w-0 flex-1"><p className={`truncate text-sm font-bold ${t.textPrimary}`}>{friend.name}</p><p className={`truncate text-[11px] ${t.textMuted}`}>@{friend.username} · {friend.habit}</p><span className="mt-1 inline-flex items-center gap-1 rounded-md bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-500"><Flame size={10} fill="currentColor" />{friend.streak}d streak</span></div><button onClick={() => handleUnfriend(friend)} aria-label={`Unfriend ${friend.name}`} className="rounded-xl bg-red-50 px-2.5 py-2 text-xs font-bold text-red-500"><UserX size={13} className="mr-1 inline" />Unfriend</button></div>)}</div>
          </>
        )}
      </div>
    </div>
  );
}

function HealthZeroOverlay({ onClose }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 p-5">
      <div className="w-full max-w-sm rounded-[28px] bg-white px-6 py-8 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
          <Heart size={32} fill="currentColor" />
        </div>
        <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-900">what a Loser</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Your HP reached 0. Build your habits back up next week.</p>
        <button onClick={onClose} className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white">Continue</button>
      </div>
    </div>
  );
}

export default function App() {
  const { theme, setTheme, isDark, t } = useTheme();
  const [user, setUser] = useState(null);
  const [habits, setHabits] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedHabitId, setSelectedHabitId] = useState(null); 
  const [socialOpen, setSocialOpen] = useState(false);
  const [socialNotification, setSocialNotification] = useState(false);
  const [health, setHealth] = useState({ health_points: 100, missed_habits: 0 });
  const [healthOverlayOpen, setHealthOverlayOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authView, setAuthView] = useState("start");
  const [language, setLanguage] = useState(() => localStorage.getItem("routine-language") || "en");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dataError, setDataError] = useState("");
  const [loginSuccessCat, setLoginSuccessCat] = useState(null);
  const [showEmailVerified, setShowEmailVerified] = useState(false);
  const { toasts, show, remove } = useToast();

  const today = todayStr();
  // Check session on mount and fetch user data
  useEffect(() => {
    (async () => {
      try {
        const callbackParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const callbackAccessToken = callbackParams.get("access_token");
        const isVerificationCallback = callbackParams.get("type") === "signup";
        const isVerificationRoute = window.location.pathname === VERIFICATION_PATH;
        let session = await supabase.getSession();

        if (callbackAccessToken && isVerificationCallback) {
          session = {
            access_token: callbackAccessToken,
            refresh_token: callbackParams.get("refresh_token"),
            expires_in: Number(callbackParams.get("expires_in") || 3600),
            expires_at: Math.floor(Date.now() / 1000) + Number(callbackParams.get("expires_in") || 3600),
            token_type: callbackParams.get("token_type") || "bearer",
          };
          supabase.session = session;
          localStorage.setItem("sb-session", JSON.stringify(session));
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
          setShowEmailVerified(true);
        }

        if (session?.access_token) {
          const user = await supabase.getUser();
          if (user) {
            setUser(user);
            await fetchUserData(user.id);
            if (isVerificationRoute) setShowEmailVerified(true);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;

    const refreshSocialNotification = async () => {
      try {
        const pendingRequests = await supabase.getPendingFriendRequests();
        if (active) setSocialNotification((pendingRequests || []).length > 0);
      } catch (error) {
        console.error("Failed to refresh social notification:", error);
      }
    };

    refreshSocialNotification();
    const timer = window.setInterval(refreshSocialNotification, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;

    const refreshHealth = async () => {
      try {
        const currentHealth = await supabase.getCurrentHealth();
        if (!active) return;
        setHealth(currentHealth);
        if (currentHealth.health_points <= 0) setHealthOverlayOpen(true);
      } catch (error) {
        console.error("Failed to refresh health:", error);
      }
    };

    refreshHealth();
    const timer = window.setInterval(refreshHealth, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user]);

  const fetchUserData = async (userId) => {
    try {
      setDataError("");
      // Fetch habits
      const dbHabits = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId)
        .execute();

      // Completion history is optional for restoring the habit list.
      let dbCompletions = [];
      const habitIds = dbHabits.map((h) => h.id);
      if (habitIds.length > 0) {
        try {
          dbCompletions = await supabase
            .from("habit_completions")
            .select("*")
            .in("habit_id", habitIds)
            .execute();
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

    } catch (err) {
      console.error("Failed to fetch user data:", err);
      setDataError(err.message || "Unable to load your saved habits.");
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
      show(`Failed to sync habit: ${err.message}`, "error", AlertCircle);
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

  const updateHabit = async (input) => {
    if (!editingHabit) return false;
    try {
      setSyncing(true);
      await supabase.from("habits").eq("id", editingHabit.id).update({
        title: input.title,
        icon: input.icon,
        time_of_day: input.timeOfDay,
      });
      setHabits((prev) =>
        prev.map((habit) =>
          habit.id === editingHabit.id
            ? { ...habit, title: input.title, icon: input.icon, timeOfDay: input.timeOfDay }
            : habit
        )
      );
      show(`"${input.title}" updated`, "success", CheckCircle);
      return true;
    } catch (err) {
      console.error(err);
      show(`Failed to update habit: ${err.message}`, "error", AlertCircle);
      return false;
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
      return true;
    } catch (err) {
      console.error(err);
      return false;
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

  const handleLogout = async () => {
    try {
      await supabase.logout();
      setUser(null);
      setHabits([]);
      setAccountOpen(false);
      setAuthView("login");
    } catch (err) {
      console.error(err);
      show("Failed to logout", "error", AlertCircle);
    }
  };

  const handleLanguageChange = (nextLanguage) => {
    setLanguage(nextLanguage);
    localStorage.setItem("routine-language", nextLanguage);
  };

  const handleUpdateProfile = async (attributes) => {
    const updatedUser = await supabase.updateUser(attributes);
    setUser(updatedUser.user || updatedUser);
    return updatedUser;
  };

  const handleUpdateUsername = async (username) => {
    await supabase.updateUsername(user.id, user.email, username);
    const updatedUser = await supabase.updateUser({ data: { username } });
    setUser(updatedUser.user || updatedUser);
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm("Delete your account and all of your data permanently?");
    if (!confirmed) return;
    try {
      await supabase.deleteUser();
      await supabase.logout();
      setUser(null);
      setHabits([]);
      setAccountOpen(false);
    } catch (err) {
      show(`Failed to delete account: ${err.message}`, "error", AlertCircle);
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
    if (authView === "start") {
      return (
        <StartingScreen
          t={t}
          onGetStarted={() => setAuthView("signup")}
          onSignIn={() => setAuthView("login")}
        />
      );
    }
    return <LoginScreen t={t} initialMode={authView} onLoginSuccess={(u) => {
      setUser(u);
      fetchUserData(u.id);
      setAuthView("login");
      const cat = loginSuccessCats[Math.floor(Math.random() * loginSuccessCats.length)];
      setLoginSuccessCat(cat);
    }} />;
  }

  if (showEmailVerified) {
    return <EmailVerifiedScreen email={user.email} onGoToDashboard={() => {
      window.history.replaceState({}, document.title, "/");
      setShowEmailVerified(false);
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
      
      <div className={`w-full max-w-6xl min-h-screen ${t.canvas} relative overflow-hidden`}>
        {loginSuccessCat && <LoginSuccessCat cat={loginSuccessCat} onDone={() => setLoginSuccessCat(null)} />}
        {healthOverlayOpen && health.health_points <= 0 && (
          <HealthZeroOverlay onClose={() => setHealthOverlayOpen(false)} />
        )}
        {socialOpen && (
          <SocialScreen
            t={t}
            user={user}
            habits={habits}
            onClose={() => setSocialOpen(false)}
            onNotificationChange={setSocialNotification}
          />
        )}
        {accountOpen && (
          <AccountSettings
            t={t}
            user={user}
            language={language}
            onLanguageChange={handleLanguageChange}
            onUpdateProfile={handleUpdateProfile}
            onUpdateUsername={handleUpdateUsername}
            onDeleteAccount={handleDeleteAccount}
            onLogout={handleLogout}
            onClose={() => setAccountOpen(false)}
          />
        )}
        
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
            onProfileClick={() => setAccountOpen(true)}
            onOpenSocial={() => setSocialOpen(true)}
            socialNotification={socialNotification}
            health={health}
          />

          <FilterBar t={t} active={activeFilter} onChange={setActiveFilter} />

          {dataError && (
            <div className="px-5 pb-3">
              <div className={`rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700`}>
                Unable to load saved data: {dataError}
              </div>
            </div>
          )}

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
                  onEdit={(habit) => {
                    setEditingHabit(habit);
                    setModalOpen(true);
                  }}
                  onOpenDetails={(id) => setSelectedHabitId(id)}
                />
              ))
            )}
          </div>

          {syncing && (
            <div className={`fixed top-4 right-4 px-3 py-1.5 rounded-full ${t.badge} text-xs ${t.textMuted} flex items-center gap-1.5`}>
              <Loader size={12} className="animate-spin" />
              Syncing…
            </div>
          )}

          <button
            onClick={() => {
              setEditingHabit(null);
              setModalOpen(true);
            }}
            className="fixed bottom-8 right-6 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform duration-150 z-40"
          >
            <Plus size={24} />
          </button>

          <AddHabitSheet
            t={t}
            open={modalOpen}
            editingHabit={editingHabit}
            onClose={() => {
              setModalOpen(false);
              setEditingHabit(null);
            }}
            onSave={editingHabit ? updateHabit : addHabit}
          />
        </div>
      </div>
    </div>
  );
}
