import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 公開網站每次請求讀取已發布內容。Cache Components 依賴 Node.js runtime，
  // Cloudflare Workers 不保證可用，因此不啟用。
};

export default nextConfig;

if (process.env.CLOUDFLARE_USE_BINDINGS === "1") {
  // Next 會把 .env.development.local 的 Workers AI token 放進 process.env。
  // 那把 token 不能建立遠端 binding。拿掉之後，Wrangler 改用已登入的 OAuth。
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_API_KEY;
  // OpenNext 這支初始化函式是同步 CommonJS 入口，只在明確要接 binding 時載入。
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare") as {
    initOpenNextCloudflareForDev: () => void;
  };
  initOpenNextCloudflareForDev();
}
