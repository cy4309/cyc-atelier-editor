import type { SiteTheme } from "./schema";

const backgrounds: Record<SiteTheme["background"], string> = {
  paper: "#f4efe6",
  ink: "#141311",
  mist: "#e6eef0",
  clay: "#efe2d4",
};

const texts: Record<SiteTheme["text"], string> = {
  ink: "#1c1916",
  paper: "#f7f3ec",
  stone: "#3d3832",
};

const accents: Record<SiteTheme["accent"], string> = {
  copper: "#9a5436",
  moss: "#2f684c",
  wine: "#7a3148",
  gold: "#8a6424",
};

const mutedFor = (background: SiteTheme["background"], text: string) =>
  background === "ink" ? "#b7b1a8" : text === "#f7f3ec" ? "#d9d3c8" : "#6d655c";

export function themeStyle(theme: SiteTheme): Record<string, string> {
  const lightBackground = theme.background !== "ink";
  let text = texts[theme.text];
  const textIsLight = theme.text === "paper";
  if (lightBackground && textIsLight) text = texts.ink;
  if (!lightBackground && !textIsLight) text = texts.paper;

  const radius = theme.radius === "sharp" ? "0px" : theme.radius === "pill" ? "999px" : "18px";
  const cardRadius = theme.radius === "sharp" ? "0px" : theme.radius === "pill" ? "28px" : "20px";
  const space = theme.density === "compact" ? "4.5rem" : theme.density === "airy" ? "8rem" : "6.25rem";

  return {
    "--site-bg": backgrounds[theme.background],
    "--site-text": text,
    "--site-muted": mutedFor(theme.background, text),
    "--site-accent": accents[theme.accent],
    "--site-accent-ink": theme.background === "ink" ? "#1a120e" : "#fffaf6",
    "--site-line": theme.background === "ink" ? "rgba(247,243,236,0.16)" : "rgba(28,25,22,0.12)",
    "--site-radius": radius,
    "--site-card-radius": cardRadius,
    "--site-section": space,
    "--site-font":
      theme.font === "modern"
        ? '"Segoe UI", "PingFang TC", "Noto Sans TC", sans-serif'
        : theme.font === "mixed"
          ? '"Iowan Old Style", Palatino, "Palatino Linotype", "Songti TC", serif'
          : '"Iowan Old Style", Palatino, "Palatino Linotype", "Songti TC", serif',
    "--site-body-font":
      theme.font === "editorial"
        ? '"Iowan Old Style", Palatino, "Palatino Linotype", "Songti TC", serif'
        : '"Segoe UI", "PingFang TC", "Noto Sans TC", sans-serif',
  };
}

export const themeOptionLabels = {
  background: { paper: "紙色", ink: "墨色", mist: "霧灰", clay: "陶土" },
  text: { ink: "墨色字", paper: "紙色字", stone: "石色字" },
  accent: { copper: "銅", moss: "苔綠", wine: "酒紅", gold: "金" },
  font: { editorial: "襯線", modern: "無襯線", mixed: "標題襯線、內文無襯線" },
  radius: { sharp: "直角", soft: "微圓", pill: "膠囊" },
  density: { compact: "緊湊", regular: "標準", airy: "寬鬆" },
} as const;
