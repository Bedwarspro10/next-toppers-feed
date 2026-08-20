---
name: Leaderboard Firestore fallback
description: Composite index requirement for leaderboard period filtering and the fallback pattern used
---

## The problem
`query(collection(db, "leaderboard"), where("weekKey", "==", ...), orderBy("xp", "desc"))` requires a composite Firestore index. If it doesn't exist, it fails silently.

## The pattern
Always wrap in onSnapshot with an error fallback that retries without the `where` clause:
```ts
onSnapshot(filteredQuery, successCb, () => {
  // fallback — no composite index yet
  onSnapshot(allQuery, successCb, () => setLoading(false));
});
```

**Why:** Students see the leaderboard without crashing while admins haven't set up composite indexes yet.

**How to apply:** Any Firestore query combining `where` + `orderBy` on different fields should use this fallback pattern.
