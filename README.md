# 🐾 PawChef · AI宠物食谱网站

## 项目结构
```
pawchef/
├── app/
│   ├── page.tsx                    # 首页
│   ├── layout.tsx                  # 根布局
│   ├── globals.css                 # 全局样式
│   ├── dashboard/page.tsx          # 用户控制台
│   ├── auth/reset-password/page.tsx # 密码重置页
│   └── api/
│       ├── generate-recipe/route.ts  # AI食谱生成
│       ├── check-ingredient/route.ts # 食材安全查询
│       ├── points/checkin/route.ts   # 每日签到
│       ├── points/checkout/route.ts  # 积分购买
│       └── stripe-webhook/route.ts  # Stripe回调
├── components/
│   ├── auth/AuthModal.tsx          # 登录注册弹窗
│   ├── recipe/RecipeDemo.tsx       # 食谱生成演示
│   ├── recipe/SafetyChecker.tsx    # 食材安全查询
│   ├── ui/PricingSection.tsx       # 定价页面
│   └── ui/PointsSection.tsx        # 积分系统
├── lib/
│   ├── supabase-client.ts          # 前端Supabase
│   ├── supabase-server.ts          # 后端Supabase
│   └── safety-db.ts               # 食材安全数据库
└── types/index.ts                  # TypeScript类型
```

## 本地运行步骤

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
```bash
cp .env.example .env.local
# 编辑 .env.local 填入你的 Keys
```

### 3. 启动开发服务器
```bash
npm run dev
# 打开 http://localhost:3000
```

---

## 部署到 Vercel（上线步骤）

### 第一步：推送到 GitHub
```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/你的用户名/pawchef.git
git push -u origin main
```

### 第二步：Vercel 连接 GitHub
1. 打开 vercel.com
2. New Project → 选择 pawchef 仓库
3. Framework: Next.js（自动检测）
4. 点 Deploy

### 第三步：添加环境变量
在 Vercel 项目设置 → Environment Variables 逐一添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| NEXT_PUBLIC_SUPABASE_URL | https://gasurwifgekbrtkqgqaj.supabase.co | Supabase项目URL |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | sb_publishable_... | Supabase前端Key |
| SUPABASE_SECRET_KEY | sb_secret_... | Supabase服务端Key |
| OPENROUTER_API_KEY | sk-or-v1-... | OpenRouter Key（充值后获取） |
| NEXT_PUBLIC_SITE_URL | https://你的域名.vercel.app | 网站URL |

Stripe相关先留空，等注册Stripe后填入。

### 第四步：重新部署
添加环境变量后点 Redeploy

---

## Supabase 邮件认证配置

1. Supabase 控制台 → Authentication → Email Templates
2. 修改邮件模板为中文（可选）
3. Authentication → URL Configuration → 添加：
   - Site URL: https://你的域名.vercel.app
   - Redirect URLs: https://你的域名.vercel.app/auth/reset-password

---

## Stripe 配置（等收到银行卡后）

1. 注册 stripe.com
2. 创建产品：
   - Pro月付 $9.9/月（订阅）
   - Pro年付 $70.8/年（订阅）
   - 积分包 100/300/600/1500（一次性）
3. 复制 Price ID 填入环境变量
4. 设置 Webhook：
   - URL: https://你的域名.vercel.app/api/stripe-webhook
   - 事件: checkout.session.completed

---

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | Next.js 14 | React框架 |
| 数据库 | Supabase | PostgreSQL + 认证 |
| AI | OpenRouter → Claude | 食谱生成 |
| 支付 | Stripe | 订阅 + 积分购买 |
| 部署 | Vercel | 自动部署，无需运维 |

---

## ⚠️ 合规声明
- 所有食谱标注"AI生成，仅供参考"
- 不替代专业兽医诊断建议
- 基于 ASPCA · AAFCO · FEDIAF 国际标准
