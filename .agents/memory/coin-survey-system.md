---
name: Coin & Survey System
description: Architecture, file locations, and anti-abuse rules for the Gold Coins + Surveys feature
---

## Feature Overview
Gold Coins replaced the XP level indicator in the nav. Students earn coins and redeem them for Premium access.

## New Files
- `artifacts/aarambh/src/contexts/CoinContext.tsx` — Core state (wallet, transactions, daily login, awards, redeem)
- `artifacts/aarambh/src/components/CoinAnimation.tsx` — CoinEarnedToast, CoinBurst, RedemptionAnimation (fullscreen flip)
- `artifacts/aarambh/src/components/CoinChip.tsx` — CoinChipMobile (topbar) + CoinChipDesktop (sidebar); link to /wallet
- `artifacts/aarambh/src/pages/Wallet.tsx` — Balance hero, three tabs: Overview / Redeem / History
- `artifacts/aarambh/src/pages/Surveys.tsx` — Student survey listing + sandboxed iframe renderer
- `artifacts/aarambh/src/pages/admin/SurveyManagerTab.tsx` — Admin CRUD for surveys (HTML content editor + preview)
- `artifacts/aarambh/src/pages/admin/CoinManagerTab.tsx` — Admin: leaderboard, manual reward, transaction log

## Firestore Collections
- `coinWallet/{uid}` — balance, lifetimeEarned, lifetimeRedeemed, monthlyRedeems, loginStreak, lastLoginDate
- `coinTransactions` — uid, amount, type, reason, createdAt
- `surveys` — title, description, category, thumbnail, rewardCoins, active, estimatedTime, maxResponses, htmlContent, responseCount
- `surveyResponses/{surveyId}_{uid}` — uid, surveyId, coinsAwarded, completedAt (unique key = per-user per-survey)
- `redeemHistory` — uid, planId, coins, days, planLabel, redeemedAt
- `testCoinAwarded/{uid}_{testId}` — anti-duplicate for test coin awards (Firestore transaction)

## Anti-Abuse Rules
1. **Test coins**: Firestore transaction writes `testCoinAwarded/{uid}_{testId}` atomically; also guarded by localStorage key `nt_testcoins_{uid}_{testId}`
2. **Survey coins**: Unique `surveyResponses/{surveyId}_{uid}` doc; `getDoc` check before award
3. **Daily login**: localStorage key `nt_dailycoin_{uid}` = today's date string; runs once per calendar day
4. **Redeem monthly limit**: `monthlyRedeems` map in wallet doc reset when `lastResetMonth` != current "YYYY-MM"; enforced inside `runTransaction`

## Redemption Plans (REDEEM_PLANS constant)
| id      | coins | days | bonus | maxPerMonth |
|---------|-------|------|-------|-------------|
| day1    |  100  |  1   |  0    |  2          |
| day3    |  300  |  3   |  1    |  2          |
| day5    |  500  |  5   |  2    |  1          |
| month1  | 1000  | 30   |  0    |  1          |

Redeem calls `extendPremium(uid, days)` from PremiumContext.

## Coin Earning Rates
- Daily login: +1/day base; +5 at 7-day streak, +25 at 30-day streak
- Tests (score-based, once per test): ≥95%→+4, ≥80%→+3, ≥60%→+2, ≥40%→+1, <40%→0
- Surveys: admin-defined per survey
- Admin manual reward: via CoinManagerTab

## Layout Changes
- Removed `useXP` / `lvlColor` / `xpProgress` from Layout.tsx entirely
- Replaced XP chip in mobile topbar with `<CoinChipMobile />`
- Replaced XP bar in desktop sidebar with `<CoinChipDesktop />`
- Added Surveys + Wallet links to both drawerItems and sidebarItems

## App.tsx Changes
- Wrapped with `<CoinProvider>` (between XPProvider and PremiumModalProvider)
- Added `<DailyLoginManager />` (fires `awardDailyLogin()` on user login)
- Routes: `/wallet` (ProtectedRoute), `/surveys` (public)

## Admin Changes
- Two new tabs in ALL_TABS: "surveys" (ClipboardList icon) and "coins" (Coins icon)
- Imported SurveyManagerTab and CoinManagerTab from `@/pages/admin/`

**Why:** The XP system only showed progress, it didn't create motivation loops. Coins give a tangible reward cycle: earn → accumulate → redeem for premium.
