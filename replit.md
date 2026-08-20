# Next Toppers – Feed

Premium Indian educational platform for Aarambh Batch 2026–27. Students access lectures, PDFs, folders, announcements, and community chat — all organized by subject.

## Run & Operate

- `pnpm --filter @workspace/aarambh run dev` — run the frontend (port 22279)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/aarambh run typecheck` — typecheck frontend only

## Stack

- **Frontend:** React + Vite, Tailwind CSS v4, shadcn/ui, wouter routing, TanStack Query
- **Backend:** Firebase Auth, Firestore (real-time), Firebase Storage
- **Fonts:** Plus Jakarta Sans (display), Inter (body)
- **Icons:** lucide-react
- **Video:** hls.js (HLS stream playback)

## Where things live

```
artifacts/aarambh/src/
  pages/
    Home.tsx          – Landing page with dark hero
    Subjects.tsx      – Subject grid (Maths, Science, SST, English, Hindi)
    SubjectDetail.tsx – Folder → File hierarchy per subject
    Chat.tsx          – Group rooms + private chat (Firebase real-time)
    Admin.tsx         – Full admin panel (7 tabs)
    YouTube.tsx       – YouTube channel videos via API proxy
    Announcements.tsx – Announcements with banner images
    Dashboard.tsx     – Student dashboard
    Login.tsx         – Split-panel Google auth
    Contact/Terms/Privacy
  components/layout/
    Layout.tsx        – Dark sidebar + mobile nav + bottom tab bar
    ProtectedRoute.tsx
  contexts/
    AuthContext.tsx   – Firebase Auth context + isAdmin check
  lib/
    firebase.ts       – Firebase init (auth, db, storage)
```

## Firebase Collections

| Collection | Purpose |
|---|---|
| `subjects` | Dynamic subjects (addable from admin) |
| `lecture_folders` | Folders per subject — `{ name, subject, order }` |
| `files` | Study files/PDFs — `{ name, link, subject, folderId, order, category, thumbnail }` |
| `lectures` | Video lectures — `{ title, hlsUrl, subject, folderId, order, category, thumbnail }` |
| `announcements` | Batch announcements — `{ title, message, imageUrl }` |
| `yt_channels` | YouTube channels — `{ name, url }` |
| `admins` | Admin access — `admins/{uid}` with `{ role: "admin" }` |
| `chatRooms/{id}/messages` | Group chat rooms (general, maths, science, sst, english, hindi) |
| `privateChats/{uid1_uid2}/messages` | Student ↔ admin private chat |
| `branding` | Logo, favicon, banner URLs |

## Architecture: Subject → Folder → File

```
Subject (e.g. Maths)
  └─ Folder (e.g. "Chapter 1 — Motion")        lecture_folders collection
       └─ File (e.g. "Motion Notes PDF")        files collection (folderId set)
       └─ Lecture (e.g. "Motion Lesson 1")      lectures collection (folderId set)
  └─ General Resources (no folderId)
```

Ordering: `order` integer field on folders, files, lectures. Admin uses ▲▼ buttons to reorder; saved back to Firestore.

## Admin Panel Tabs

1. **Subjects** — add/view dynamic subjects
2. **Folders** — create folders per subject, rename, delete, reorder with ▲▼
3. **Resources** — upload files/lectures with folder assignment, filter/reorder
4. **Alerts** — post announcements with banner image upload
5. **YouTube** — add YouTube channels
6. **Chat** — moderate group chat rooms (delete messages)
7. **Branding** — upload logo/banner to Firebase Storage

## Chat System

- **Group rooms:** general, maths, science, sst, english, hindi — real-time Firestore `onSnapshot`
- **Private:** student ↔ admin DM, chatId = sorted UIDs joined by `_`
- Protected route — login required
- Admin can delete any message in group rooms

## Product

Students sign in with Google, browse subjects, open folders, view PDFs (external link) or watch HLS lectures inline. They also join batch chat rooms for discussion and can DM admin for support. Admins manage all content via a 7-tab panel without touching code.

## User preferences

- Keep Firebase as sole backend — no separate DB/server for student features
- All subjects: Maths, Science, SST, English, Hindi (+ dynamic from admin)
- Branding: "Next Toppers – Feed", logo at `/logo.png`
- Do NOT rebuild existing features — only extend

## Gotchas

- Firestore `orderBy("order")` requires a composite index if combined with `where()`. The app falls back gracefully (catches error, re-queries without `orderBy`, then JS-sorts).
- Chat is protected — unauthenticated users get redirected to `/login`.
- HLS playback uses hls.js; Safari uses native `<video>` with `.m3u8` src fallback.
- Firebase Storage rules must allow authenticated writes for uploads to work.

## Pointers

- See the `pnpm-workspace` skill for workspace structure and TypeScript setup.
