# 第二階段研究筆記：Replit / Coding Agent 直接改程式碼

查證日期：2026-10-20。

這份文件只做技術調查。第一階段沒有接入 Replit Agent，也沒有呼叫任何非官方 endpoint。

同事提出的方案可能落在哪一類，這裡不能從現有資料斷定。下面四種都說得通，需要問同事他實際拿到的是產品畫面、建好再部署的網站，還是一支可程式化 API：

- A. 業主直接使用 Replit Agent 的產品介面。
- B. 開發者用 Replit Agent 把網站做出來，再把成品部署出去。業主之後不碰 Agent。
- C. 自製業主後台，後端透過某個受支援的 API 或 agent runtime，讓 AI 修改某個 repo。
- D. 自動化 GitHub pull request、測試與部署。Agent 產出的是 PR，不是直接改正式環境。

## 三個不能混在一起的概念

| 概念 | 它是什麼 | 查到的官方入口 |
| --- | --- | --- |
| Replit Agent 產品 UI | 登入 Replit 後，在專案裡跟 Agent 對話、看它改檔與發布 | 產品本身，不是一支給外部網站嵌入的 API |
| Replit 專案 runtime | 專案在 Replit 上執行、儲存與發布的環境 | [Publishing costs](https://docs.replit.com/billing/deployment-pricing) |
| 可程式化的外部入口 | 讓 Replit 以外的客戶端建立、更新、發布 App | [Replit MCP Server](https://docs.replit.com/platforms/mcp-server) |

## 可驗證的官方資訊

以下內容來自上述文件與 [定價說明](https://docs.replit.com/help/pricing-and-plans)、[AI billing](https://docs.replit.com/billing/ai-billing)，查證日 2026-10-20。

1. Replit 有官方 MCP server，網址是 `https://mcp.replit.com/server/mcp`，傳輸是 Streamable HTTP，驗證是 OAuth。文件寫明不要自建 OAuth server，也不要加 bearer token 或自訂 header。客戶端讀 Replit 的 protected-resource metadata，再引導使用者登入。
2. 文件列出的工具包含 `create_app_from_prompt`、`update_app_using_prompt`、`ask_question`、`publish_app`、`get_publish_status`，以及搜尋與列出 app 的工具。`update_app_using_prompt` 需要 `replId` 與 `changeDescription`。這表示：一個已經登入 Replit 的 MCP 客戶端，可以對「該帳號有權編輯的 app」送出一段修改說明。
3. 文件把這個入口描述成 ChatGPT、Claude、Slack、Codex、Claude Code 這類 MCP 客戶端使用。它沒有描述成「把業主後台的 Prompt 轉交給 Agent，並操作我們指定的某個專案」的公開 REST API，也沒有列出給伺服器端嵌入的 API key 方案。
4. 因此，目前查得到的官方可程式化入口是 MCP，不是一支可放進任意網站後端、用我們自己的 secret 替所有業主改同一個專案的 Agent REST API。沒有看到這種 REST API，就不該用模擬回應或非官方網址補上。
5. 方案與額度，依查證當下的說明：
   - Starter 為免費方案，Agent 有每日上限，已發布 app 為 1 個。文件提到 Starter 的發布 app 會在 30 天後到期，可以再發布。
   - Core 包含每月 credits，文件寫每年費用為 204 美元，並寫每月 credits 為 20 美元。Core 的 credits 每個計費週期重置，不結轉。文件這段沒有單獨列出月繳牌價，月繳數字請以 [定價頁](https://replit.com/pricing) 當下顯示為準。
   - Pro 為每月 100 美元，credits 可結轉兩個月，並行 Agent 任務與協作者上限更高。
   - Agent 有 Free Mode。付費模式依請求複雜度計價，開始前會要求確認。Plan mode 即使不改程式也可能產生可計費的推理。
   - 發布、儲存與流量也從同一份 credits 扣。Autoscale 依請求使用的運算計費，閒置時文件說不計運算；靜態部署主要計流出流量。Core 文件上下文提到包含一定額度的流量，超出後繼續扣 credits。精確的 GiB 與單價會變，部署前要重看 publishing costs。
6. 資料與權限：App 存在該 Replit 帳號底下。MCP 文件寫可以操作自己能編輯的 app，包含別人分享給你的 app。這不是多租戶權限模型。Core 的資料庫還原窗口，定價說明寫的是 7 天；Pro 是 28 天。

## 合理推論

- MCP 的 OAuth 綁的是 Replit 使用者本人。若把代理商的 Replit 帳號接進業主後台，所有業主會共用那組權限，也能碰到該帳號下其他 app。這不適合當正式產品的隔離邊界。
- `update_app_using_prompt` 是「請 Agent 開始改這個 app」，不是「產生一個可審核的 diff，測試通過才發布」。文件裡的 `publish_app` 是另一個工具。中間沒有看到強制的 lint、測試與人工核准步驟。
- 所以 C 方案即使改走官方 MCP，仍然缺隔離工作區、測試閘門與逐租戶權限。不能把它理解成已經有一個可嵌入的免費 Agent API。

## 仍待確認

- Extensions API 是否已有官方的 `agent.invoke`。2025-09-10 的 [社群功能請求](https://replit.discourse.group/t/extensions-api-require-programmatic-agent-invocation-with-prompt-text-support-in-build-mode/6963) 主張當時沒有這個能力。那是社群貼文，不是官方文件，而且這次沒有再核對現行 Extensions API 參考，不能拿它證明 2026-10-20 仍然沒有。
- MCP `update_app_using_prompt` 的實際計費、逾時、是否保證只改指定檔案，以及失敗時是否自動回滾。工具表沒有寫這些細節。
- Core 月繳牌價，以及 Starter 每日 Agent 次數的精確數字。這次摘到的是方案差異與年繳 204 美元，不是一份完整價目表。
- 同事手上的方案到底是 A、B、C 還是 D。

## 若要做「業主 Prompt 改程式碼」

比較接近可營運的架構不是把業主直接放進共用主分支，而是：

1. 業主 Prompt 進入後端工作佇列。
2. 每個任務使用隔離的工作環境與獨立 Git 分支。
3. Coding agent 只在該分支改程式。
4. 跑 lint、typecheck、test、build。失敗就不產生可發布的預覽。
5. 預覽部署給業主看。保留 Git diff 與操作紀錄。
6. 業主核准後才進正式部署。正式環境不執行未受限的程式，業主也不能推共用主分支。

Replit 可以當第 3 步的 agent runtime，但查證當下只看到 MCP 這個官方外部入口，而且它綁的是 Replit 帳號，不是我們後台的租戶。GitHub 上的 coding agent 配 Cloudflare 預覽部署，比較容易把「分支、PR、檢查、預覽、核准」放在我們自己的權限模型裡。

## 和 GitHub + Cloudflare 的比較

| | Replit Agent | GitHub + Cloudflare |
| --- | --- | --- |
| 適合 | 業主或開發者本人就在 Replit 裡做專案，接受 Replit 的發布與 credits | 網站已經部署在 Cloudflare，修改要走 PR、CI 與預覽 |
| 業主體驗 | 直接使用 Replit 介面最快 | 需要一層我們自己的後台，或請業主看 PR / 預覽網址 |
| 隔離 | 依 Replit 帳號與分享權限。共用一把登入會把專案混在一起 | 一業主一分支或一 repo，正式分支受保護 |
| 費用風險 | Agent、發布、流量、資料庫共用 credits。複雜修改與閒置以外的流量都會吃額度，Core credits 不結轉 | Cloudflare 有免費額度，超出後依 Workers、D1 與建置計費。GitHub Actions 分鐘數也要另計。Agent 若用別家模型，再加一筆 API 費 |
| 失敗與回復 | 產品內有 checkpoint / rollback，窗口依方案不同 | Git revert 或重新部署上一個 Worker 版本，歷史留在 repo |
| 這次 demo 的關係 | 不適合拿來取代第一階段的結構化編輯器 | 第一階段已經用 Next.js + OpenNext + D1。第二階段若要改程式，預覽可以沿用 Cloudflare，不必先搬去 Replit |

## 結論

同事的方案在被確認前，不要把它說成某一種。官方目前能對上「從 Replit 外面驅動 Agent」的，是 MCP server，而且使用者必須用自己的 Replit 帳號授權。沒有查到可免費嵌入、用伺服器 secret 替外部業主改指定專案的公開 Agent REST API。

若目標是業主安全地改「網站內容與主題」，第一階段這種受 schema 限制的草稿 / 發布流程風險較小。若目標是業主用自然語言改程式，應走隔離分支、自動檢查、預覽與核准，而不是讓每位業主操作共用主分支。Replit 適合已經生活在 Replit 裡的團隊；GitHub + Cloudflare 比較適合這個 demo 已經選的部署方式，也比較容易把權限留在我們這邊。兩邊的費用都要在實作當下重新核對，不能把今天看到的 credits 或 Neurons 當成永久免費。
