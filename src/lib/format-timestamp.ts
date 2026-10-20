const taipeiClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h12",
});

// Node 與瀏覽器的 zh-TW toLocaleString 會在日期與「下午」之間放不同空白，造成 hydration mismatch。
export function formatTaipeiTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = Object.fromEntries(taipeiClock.formatToParts(date).map((part) => [part.type, part.value]));
  const period = parts.dayPeriod === "PM" ? "下午" : "上午";
  return `${parts.year}/${parts.month}/${parts.day} ${period}${parts.hour}:${parts.minute}:${parts.second}`;
}
