---
name: Icon style prop TypeScript pattern
description: How to apply dynamic color styles to lucide-react icons in TypeScript without TS errors
---

## The problem
When mapping subjects to icon components (e.g. `Record<string, React.ComponentType<...>>`), TypeScript doesn't know the icon accepts `style={{ color }}` — it errors with "No overload matches".

## The fix
Wrap the icon in a `<span style={{ color }}>`:
```tsx
// WRONG — TS error
<Icon size={22} style={{ color }} />

// CORRECT
<span style={{ color }}><Icon size={22} /></span>
```

**Why:** The inferred component type loses the HTML attribute signature. Wrapping in span gives color inheritance without touching the icon props.
