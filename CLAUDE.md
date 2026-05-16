# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 Product Requirements (核心项目原则 — 所有开发必须遵守)

**付费用户（Pro 订阅 + 付费积分用户）的食谱必须达到以下标准。任何修改都不能违背这些原则：**

1. **必须完全符合 AAFCO 营养标准** — 不允许出现 `partial` 或 `non-compliant` 标签
   - 蛋白质、脂肪、钙、磷、Ca:P 比、Omega-3、牛磺酸（猫）全部达到 AAFCO 最低要求
   - 健康成宠：100% `compliant`；幼宠/病症宠物按对应专属标准
   
2. **食材和食谱整体必须合理，支持长期食用**
   - 食材安全（无 toxic、无物种禁用）
   - 营养均衡（不依赖单一食材堆砌）
   - 适合长期作为主食（搭配综合维矿补充剂时）

3. **食谱必须精准匹配宠物属性**
   - 物种：狗/猫（猫的蛋白质和牛磺酸要求更严格）
   - 年龄：幼犬/幼猫/成宠/老年，标准不同
   - 体重：影响热量、克重、补充剂剂量
   - 健康状况：肾病/胰腺炎/糖尿病/肥胖/过敏 — 必须严格遵循专属指南

4. **风险声明**：付费用户看到不合规标签 → 退费、投诉、控诉风险。代码层面必须保证此前提。

**违反这些原则的修改（如：放宽 AAFCO 容差、降低标准换取合规率）不被接受。**

## Commands

```bash
npm run dev       # Start dev server at http://localhost:3000
npm run build     # Production build
npm run lint      # ESLint
npx jest          # Run all tests
npx jest --testPathPattern=pawchef  # Run specific test file
```

## Git Workflow

**Always commit and push directly to `main` immediately after every fix — no feature branches, no confirmation needed.**

```bash
git add <files>
git commit -m "..."
git push origin main
```

If working inside a `.claude/worktrees/` directory, merge to main first:
```bash
cd D:/petpj/pawchef   # parent repo
git merge claude/<worktree-branch> --no-edit
git push origin main
```

## Architecture

### Tech Stack
- **Next.js 14** App Router, deployed on Vercel
- **Supabase** — PostgreSQL + Auth (cookie-based via `@supabase/ssr`)
- **OpenRouter** — AI gateway; free tier uses `anthropic/claude-3-5-haiku`, Pro uses `anthropic/claude-sonnet-4-5`
- **Stripe** — subscriptions (Pro monthly/annual) + one-time credit packs
- **next-intl** — i18n for zh/en/es/fr/ja/ko (message files in `messages/`)
- **Jest + ts-jest** — unit tests in `__tests__/`

### User Credit Tiers (`types/index.ts` → `DeductSource`)
Priority order when generating a recipe:
1. `free_ai_quota` — 2 free uses per registered user (`free_ai_used` < `free_ai_limit`)
2. `gift_ai_points` — gifted credits (expire monthly)
3. `paid_points` — purchased credit packs
4. `pro_monthly` — Pro subscribers, 30/month (`monthly_ai_count` < 30)
5. `guest` — 1 lifetime use per device (tracked by token + IP + fingerprint in `guest_usage` table)

Credits are deducted via Supabase RPC: `deduct_free_ai` / `deduct_ai_credits`. Refunded on failure via `refund_free_ai` / `refund_ai_credit`.

### Recipe Generation Flow (`app/api/generate-recipe/route.ts`)
1. Auth check → determine `deductSource` → deduct credits upfront
2. Build prompt (`freePrompt` or `proPrompt`) with portion guidance injected
3. Call OpenRouter AI → parse JSON response → `syncStepsIngredients()` (fixes hallucinated supplement mentions)
4. **Pro only**: filter species-unsafe/forbidden ingredients
5. **Pro only**: `resolveUnknownIngredients()` — USDA API lookup for ingredients not in local DB
6. `validateRecipe()` → AAFCO compliance check → auto-supplement (calcium carbonate, fish oil, taurine)
7. If calories off by ≤50%: `scaleToTargetCalories()`; if off >50% and Pro: full retry
8. If `non-compliant` (free) or `partial`/`non-compliant` (Pro): compliance retry (one extra AI call)
9. `isCriticalFailure` = non-compliant AND **both** protein AND fat fail → refund + error
10. Return final ingredients (scaled mains + auto-supplements) + compliance metadata

### Nutrition Validation (`lib/nutrition-validator.ts`)
- AAFCO standards (per 1000 kcal): `AAFCO_DOG_ADULT`, `AAFCO_DOG_PUPPY`, `AAFCO_CAT_ADULT`, `AAFCO_CAT_KITTEN`
- **Compliance labels**: `compliant` (0 failures + caloriesOk) / `partial` (≤1 failure) / `non-compliant` (≥2 failures)
- **Auto-supplements**: calcium carbonate (calcium/Ca:P ratio deficit), fish oil (omega-3 AND fat deficit merged — takes larger of the two, capped by pancreatitis limit), taurine (cats only)
- Fish oil pancreatitis cap: `min(weightKg × 0.1, 1g)`; normal cap: `min(weightKg × 0.3, 3g)`
- `scaleToTargetCalories()` proportionally scales all ingredient amounts to hit DER target

### Local Nutrition DB (`lib/nutrition-db.ts`)
Static database of ~25 ingredients with per-100g macros + minerals. Each entry has `dogSafe`, `catSafe`, `forbiddenFor` (health conditions), `cautionFor`. Pro recipes can use ingredients outside this DB — they are resolved via USDA API.

### USDA API Fallback (`lib/usda-api.ts`)
For Pro users, unknown ingredients follow: local DB → `nutrition_cache` table (Supabase) → USDA FoodData Central API → category-average fallback. Requires `USDA_API_KEY` env var.

### Pro Recipe Diversity
- Featured protein randomly chosen each generation from an expanded pool (cod excluded — too lean at 0.7% fat)
- Last 3 recipes queried to extract used vegetables → injected as "AVOID repeating" note into proPrompt
- Temperature 0.9 for Pro vs 0.7 for free

### Key Constraints
- **Free users**: health conditions stripped server-side (always `healthy`); fixed ingredient list in prompt
- **Pro users**: all health conditions allowed; open ingredient selection with forbidden-toxics list
- **All API routes using `cookies()`** must have `export const dynamic = 'force-dynamic'` to avoid Next.js build errors
- Non-Pro users with >30% unknown ingredients get a refund and `INGREDIENT_MISMATCH` error

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase anon/publishable key |
| `SUPABASE_SECRET_KEY` | ✅ | Supabase service role key (server-only) |
| `OPENROUTER_API_KEY` | ✅ | OpenRouter API key for AI calls |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Site URL for auth redirects |
| `USDA_API_KEY` | ⚠️ | USDA FoodData API key (Pro ingredient lookup) |
| `STRIPE_SECRET_KEY` | ⚠️ | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | ⚠️ | Stripe webhook verification |

## Supabase Tables
- `profiles` — user settings, credit balances, Pro status
- `recipes` — saved recipe history (content includes ingredients + steps)
- `guest_usage` — one row per guest generation (token + IP + fingerprint)
- `feeding_log` — meal logging for nutrition tracking
- `point_transactions` — credit debit/refund audit trail
- `nutrition_cache` — USDA API results cache (keyed by `db_name`)

## i18n
All user-facing strings use `next-intl`. Message files are in `messages/{locale}.json`. Compliance labels follow the pattern `compliance.label.{compliant|partial|non-compliant}_{dog_adult|dog_puppy|cat_adult|cat_kitten}`. Supplement reason keys follow `supplement.reason.{calcium|omega3|fat_and_omega3|taurine}_deficiency`.
