# CYC Atelier 網站編輯器 Demo

虛構品牌 CYC Atelier 的形象網站，以及一個給業主使用的編輯後台。業主用自然語言描述修改，伺服器把 Prompt 送給 Cloudflare Workers AI，收回受限制的 JSON 修改指令；通過 schema 驗證後先進入草稿，業主確認後才發布。

查證日期：2026-10-20。免費額度、模型與部署方式都可能變動，下面的數字與指令只代表查證當下，不承諾永久免費。

## 這版做了什麼

- 公開單頁網站：頁首、主視覺、品牌介紹、服務卡片、聯絡與頁尾。桌面與手機版共用同一組內容。
- `/admin`：Prompt、例句、AI 修改摘要、逐項勾選、預覽、發布、放棄草稿、復原上一版，以及不依賴 AI 的欄位編輯。
- 草稿與已發布內容分開。公開網站只讀已發布版本。
- AI 只能改白名單欄位。主題是固定選項，不接受任意 CSS。連結只允許 `https:`、站內 `/` 路徑或 `#` 錨點。
- 本機開發把資料寫進 `.data/site.json`。部署到 Cloudflare 時改走 D1。兩種儲存實作同一個 repository。
- 沒有登入系統。開發模式若沒設定 `ADMIN_TOKEN` 會開放本機寫入並在畫面上說明。正式環境沒有權杖時，管理寫入會直接拒絕。

## 本機啟動

需要 Node.js 22 或更新版本。

```bash
npm install
npm run dev
```

打開 [http://localhost:3000](http://localhost:3000) 看網站，打開 [http://localhost:3000/admin](http://localhost:3000/admin) 編輯。第一次讀取會建立 `.data/site.json`。

不設定 AI 時，後台會顯示「尚未設定 AI」。Prompt 不會被關鍵字規則假裝處理。欄位編輯、預覽、發布與復原仍可使用，用來確認資料流程。

## 設定 AI

模型預設是 `@cf/meta/llama-3.3-70b-instruct-fp8-fast`。2026-10-20 的 [Workers AI JSON Mode 文件](https://developers.cloudflare.com/workers-ai/features/json-mode/) 列出它支援 JSON mode。文件也寫明模型不保證符合 schema，失敗時會回 `JSON Mode couldn't be met`，而且 JSON mode 不能串流。這個 demo 會在伺服器再驗證一次，失敗就重試最多一次，仍然失敗就不改草稿。

### 本機呼叫 REST API

複製 `.env.example` 為 `.env.local`，填入：

```bash
CLOUDFLARE_ACCOUNT_ID=你的帳號 id
CLOUDFLARE_API_TOKEN=具有 Workers AI 權限的 token
WORKERS_AI_MODEL=@cf/meta/llama-3.3-70b-instruct-fp8-fast
ADMIN_TOKEN=自訂一組管理權杖
```

Token 只放在伺服器環境變數。不要提交 `.env.local`，也不要加 `NEXT_PUBLIC_` 前綴。

### Cloudflare 上使用 binding

`wrangler.jsonc` 已宣告 `AI` binding。部署後不需要把 API token 放進 Worker 才能呼叫 Workers AI。`ADMIN_TOKEN` 用 secret，不要寫進 wrangler 設定檔：

```bash
npx wrangler secret put ADMIN_TOKEN
```

## 免費額度

依 2026-10-20 的 [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)：

- Workers Free 與 Workers Paid 都有每天 10,000 Neurons。
- 超過後，Free 方案不能繼續用；Paid 方案以每 1,000 Neurons 0.011 美元計費。
- 額度每天 00:00 UTC 重置。超額時請求會失敗。
- 部分前沿模型必須付費。查證當下，預設的 Llama 3.3 70B 不在該份文件的付費限定清單裡。上線前請再打開模型頁確認。

Workers 與 D1 本身也有免費額度，同樣可能調整。請以 Cloudflare 當下文件為準。

## Cloudflare D1

1. 登入 Wrangler：`npx wrangler login`
2. 建立資料庫：`npx wrangler d1 create cyc-atelier`
3. 把回傳的 `database_id` 寫進 `wrangler.jsonc` 的 `d1_databases[0].database_id`。檔案裡的全 0 id 只是佔位，不能拿去部署。
4. 套用 migration：

```bash
npm run db:migrate:local
npx wrangler d1 migrations apply cyc-atelier --remote
```

本機 `npm run dev` 預設使用 `.data/site.json`，因為 Workers 的檔案系統不能當作持久資料庫，而 `getCloudflareContext()` 在一般 Next dev 裡沒有 D1。若要在 `next dev` 改走本機 D1，先完成本機 migration，再設 `CLOUDFLARE_USE_BINDINGS=1`。

資料表是 `site_documents`（目前草稿與已發布內容）和 `site_revisions`（發布前的已發布快照，最多 20 筆）。復原會回到最近一次發布之前的內容。

## 部署到 Cloudflare

2026 年 Cloudflare 建議新的 Next.js 專案用 [vinext](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)。vinext 仍是 beta，而且會改用 Vite 取代 Next 編譯器。這個 demo 要維持標準 Next.js App Router，讓 `next dev`、測試與正式建置是同一套程式，所以部署選 `@opennextjs/cloudflare`。官方的 [OpenNext 文件](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)（2026-10-12）寫明新專案優先考慮 vinext，OpenNext 用來維持既有 Next 應用。這個取捨記在這裡，避免之後看成沒有評估過。

Cache Components 沒有打開。它需要 Node.js runtime，Workers 不保證支援，而且這個網站每次請求都要讀最新的已發布內容。

部署前請先換上真實的 D1 id、執行 remote migration，並設定 `ADMIN_TOKEN`。

```bash
npm run deploy
```

這會先跑 `next build`，再用 OpenNext 部署 Worker。本機若要先用 Workers runtime 看：

```bash
npm run preview
```

這份說明依照 OpenNext 與 Wrangler 查證當下的文件，以及這個 repo 的設定檔撰寫。本次環境沒有 Cloudflare 帳號，所以沒有對真實帳號執行 `d1 create` 或 `deploy`。部署前請再對一次你帳號裡的資料庫 id、secret 與 Worker 名稱。

部署後確認：

- `/` 讀的是已發布內容，重新整理仍在。
- `/admin` 沒有權杖時不能寫入。
- 草稿不會自動出現在公開網站。
- AI binding 存在時，Prompt 會打到 Workers AI；不存在時畫面顯示尚未設定，而不是假成功。

## 檢查

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## 架構

```text
Prompt → /api/admin/ai → Workers AI → JSON
       → schema / 白名單 / URL / 主題 enum
       → 回傳建議（不寫入）
業主勾選 → /api/admin/draft → 只更新草稿
業主發布 → published 取代為草稿，舊的 published 進歷史
公開頁 / 只讀 published
```

AI provider 有兩條路，UI 不綁其中一條：Worker 上的 `AI` binding，或本機用帳號 id 與 API token 呼叫 REST。模型輸出一律再驗證，不執行模型給的程式。

## 正式上線前還沒做的安全措施

這個 demo 是單一管理者模式。

- 沒有真正的帳號、密碼重設、租戶隔離或權限角色。`ADMIN_TOKEN` 只是一把共享權杖。
- 沒有稽核日誌後台、速率限制或防機器人。目前只限制 Prompt 長度與請求大小。
- 管理 API 在正式環境依賴權杖。不要在沒設定 `ADMIN_TOKEN` 的情況下把正式環境當公開產品。
- 沒有接 Replit Agent，也不能改 repo、環境變數、資料庫結構或後端程式。
- 圖片 URL 只做協定檢查，沒有再下載或掃描遠端檔案。

第二階段若要讓 coding agent 直接改程式，見 [docs/phase-2-coding-agent-research.md](docs/phase-2-coding-agent-research.md)。那份筆記沒有被實作進這個 demo。
