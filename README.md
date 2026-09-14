# Routine - Multi-User Habit Tracker

A fast, lightweight habit tracking and journaling web app with Supabase authentication and real-time sync.

## Features

- ✅ User authentication (sign up / login)
- ✅ Create and track daily habits
- ✅ 7-day completion heatmap
- ✅ Streak counter
- ✅ Daily journal with image attachments
- ✅ Dark/light mode
- ✅ Real-time sync to Supabase

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Deploy to Vercel

1. **Initialize a Git repository:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Push to GitHub:**
   - Create a new repository on GitHub
   - Run:
     ```bash
     git remote add origin https://github.com/YOUR_USERNAME/routine-habit-tracker.git
     git branch -M main
     git push -u origin main
     ```

3. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Vite settings
   - Click "Deploy"

Your app is now live at a `*.vercel.app` URL.

## Build for Production

```bash
npm run build
```

This creates an optimized `dist/` folder ready for deployment.

## Supabase Setup

The app is pre-configured with your Supabase project:
- URL: `https://oymdanzmnpvfwzoawvua.supabase.co`
- Anon Key: Already embedded (safe to expose)

Users can sign up and log in. Each user only sees their own data (enforced by Row-Level Security).

## Manage Users

Go to your Supabase dashboard:
1. **Authentication > Users** to see all signed-up accounts
2. Delete, disable, or reset passwords as needed

## Architecture

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Supabase (Postgres + Auth)
- **Styling**: Lucide icons + custom theme system
- **Storage**: Server as source of truth; local state is a cache

No real-time subscriptions yet — page refresh fetches latest data.
