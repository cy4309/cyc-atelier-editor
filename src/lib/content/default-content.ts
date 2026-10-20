import type { SiteContent } from "./schema";

export const defaultContent: SiteContent = {
  brand: {
    name: "CYC Atelier",
    nav: [
      { label: "品牌", href: "#about" },
      { label: "服務", href: "#services" },
      { label: "聯絡", href: "#contact" },
    ],
  },
  hero: {
    eyebrow: "台北 · 慢下來的日常",
    title: "把光留在桌面上",
    description:
      "CYC Atelier 是一間以自然光、手作器物與安靜節奏為核心的工作室。我們替想把日子過得更清楚的人，整理空間、挑選器皿，也留一杯剛好的咖啡。",
    buttonLabel: "聯絡我們",
    buttonHref: "#contact",
    imageUrl: "/images/cafe-day.svg",
    imageAlt: "有自然光的咖啡桌與窗邊植物",
  },
  about: {
    title: "關於工作室",
    body: "我們相信日常值得被好好對待。工作室位於安靜的巷弄，白天以窗光工作，晚上把桌面留白。這裡不做喧鬧的提案，只把材質、比例與使用方式慢慢對好。\n\n如果你正在準備一個家、一間小店，或只是想讓早晨有一個固定的儀式，歡迎先來坐一下。",
    imageUrl: "/images/atelier.svg",
    imageAlt: "工作室桌面上的器皿與草圖",
  },
  services: {
    title: "服務",
    items: [
      {
        id: "space",
        title: "空間整理",
        description: "依照光線與動線，重新安排桌面、層架與停留的位置。",
      },
      {
        id: "objects",
        title: "器物選品",
        description: "從杯、盤到收納，挑選可以天天使用、也不會吵到視線的物件。",
      },
      {
        id: "coffee",
        title: "晨間咖啡課",
        description: "用一個小時學會穩定的手沖節奏，讓早晨自己開始。",
      },
    ],
  },
  contact: {
    title: "聯絡我們",
    description: "告訴我們你想調整的空間或想學的事情。我們會在兩個工作天內回信，約一個適合的時間。",
    buttonLabel: "寫信給我們",
    buttonHref: "#contact",
  },
  footer: {
    text: "© CYC Atelier · 台北",
  },
  layout: {
    order: ["about", "services", "contact"],
  },
  theme: {
    background: "paper",
    text: "ink",
    accent: "copper",
    font: "editorial",
    radius: "soft",
    density: "regular",
  },
};

export const promptExamples = [
  "把首頁主標題改成：讓日常多一點靈感",
  "整體改成深色、極簡、有高級感的風格",
  "把主視覺圖片換成更有自然光感的咖啡店照片",
  "把服務區塊移到品牌介紹前面",
  "把聯絡我們按鈕改成「預約諮詢」",
  "把品牌介紹縮短成兩句話",
];
