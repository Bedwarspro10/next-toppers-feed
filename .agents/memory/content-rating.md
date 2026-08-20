---
name: ContentRating architecture
description: How the rating system stores data in Firestore and how the popup/compact components work
---

## Storage paths
- User rating: `ratings/{contentId}_{contentType}/users/{uid}` → `{ rating, feedback, uid, updatedAt }`
- Aggregate: `ratings/{contentId}_{contentType}/meta/aggregate` → `{ avg, count }`

## Components
- `ContentRating` — inline (compact badge or full star row) rendered in place on content cards
- `RatingPopup` — beautiful modal overlay with star selection + optional feedback textarea + success state
- `RatingPrompt` — deprecated alias for `RatingPopup` kept for backward compat

## Rating trigger in TestEngine
- `showRatingPopup` state in TestEngine; set to true 3500ms after phase transitions to "result"
- Only triggers on fresh test completion (not previousResult)

**Why:** Firestore aggregation is done client-side (fetch all user ratings, compute avg) since there's no cloud function. This is fine for small cohorts (<1000 students).

**How to apply:** Any page that shows content (lectures, files, tests) can import `ContentRating` compact mode for the card badge, and `RatingPopup` for a trigger after consuming content.
