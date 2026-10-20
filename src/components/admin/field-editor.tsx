"use client";

import type { ReactNode } from "react";
import type { SiteContent } from "@/lib/content/schema";
import {
  ACCENT_OPTIONS,
  BACKGROUND_OPTIONS,
  DENSITY_OPTIONS,
  FONT_OPTIONS,
  RADIUS_OPTIONS,
  TEXT_OPTIONS,
} from "@/lib/content/schema";
import { themeOptionLabels } from "@/lib/content/theme";

const sectionNames = { about: "品牌介紹", services: "服務", contact: "聯絡" } as const;

export function FieldEditor({
  content,
  onChange,
}: {
  content: SiteContent;
  onChange: (content: SiteContent) => void;
}) {
  function update<K extends keyof SiteContent>(key: K, value: SiteContent[K]) {
    onChange({ ...content, [key]: value });
  }

  function moveSection(index: number, direction: -1 | 1) {
    const next = content.layout.order.slice();
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    update("layout", { order: next });
  }

  function moveService(index: number, direction: -1 | 1) {
    const items = content.services.items.slice();
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const [item] = items.splice(index, 1);
    items.splice(target, 0, item);
    update("services", { ...content.services, items });
  }

  return (
    <div className="grid gap-4">
      <Field label="品牌名稱">
        <input value={content.brand.name} onChange={(event) => update("brand", { ...content.brand, name: event.target.value })} />
      </Field>
      {content.brand.nav.map((item, index) => (
        <div className="grid gap-3 sm:grid-cols-2" key={`${item.href}-${index}`}>
          <Field label={`導覽 ${index + 1} 文字`}>
            <input
              value={item.label}
              onChange={(event) => {
                const nav = content.brand.nav.slice();
                nav[index] = { ...item, label: event.target.value };
                update("brand", { ...content.brand, nav });
              }}
            />
          </Field>
          <Field label={`導覽 ${index + 1} 連結`}>
            <input
              value={item.href}
              onChange={(event) => {
                const nav = content.brand.nav.slice();
                nav[index] = { ...item, href: event.target.value };
                update("brand", { ...content.brand, nav });
              }}
            />
          </Field>
        </div>
      ))}
      <Field label="首頁眉標">
        <input value={content.hero.eyebrow} onChange={(event) => update("hero", { ...content.hero, eyebrow: event.target.value })} />
      </Field>
      <Field label="首頁標題">
        <input value={content.hero.title} onChange={(event) => update("hero", { ...content.hero, title: event.target.value })} />
      </Field>
      <Field label="首頁描述">
        <textarea value={content.hero.description} onChange={(event) => update("hero", { ...content.hero, description: event.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="主按鈕文字">
          <input value={content.hero.buttonLabel} onChange={(event) => update("hero", { ...content.hero, buttonLabel: event.target.value })} />
        </Field>
        <Field label="主按鈕連結">
          <input value={content.hero.buttonHref} onChange={(event) => update("hero", { ...content.hero, buttonHref: event.target.value })} />
        </Field>
      </div>
      <Field label="主視覺圖片 URL">
        <input value={content.hero.imageUrl} onChange={(event) => update("hero", { ...content.hero, imageUrl: event.target.value })} />
      </Field>
      <Field label="品牌介紹標題">
        <input value={content.about.title} onChange={(event) => update("about", { ...content.about, title: event.target.value })} />
      </Field>
      <Field label="品牌介紹內文">
        <textarea rows={5} value={content.about.body} onChange={(event) => update("about", { ...content.about, body: event.target.value })} />
      </Field>
      <Field label="品牌介紹圖片 URL">
        <input value={content.about.imageUrl} onChange={(event) => update("about", { ...content.about, imageUrl: event.target.value })} />
      </Field>
      <Field label="服務標題">
        <input value={content.services.title} onChange={(event) => update("services", { ...content.services, title: event.target.value })} />
      </Field>
      {content.services.items.map((item, index) => (
        <fieldset className="grid gap-3 rounded-xl border border-stone-200 p-3" key={item.id}>
          <legend className="px-1 text-sm font-medium">服務 {index + 1}</legend>
          <Field label="標題">
            <input
              value={item.title}
              onChange={(event) => {
                const items = content.services.items.slice();
                items[index] = { ...item, title: event.target.value };
                update("services", { ...content.services, items });
              }}
            />
          </Field>
          <Field label="說明">
            <textarea
              value={item.description}
              onChange={(event) => {
                const items = content.services.items.slice();
                items[index] = { ...item, description: event.target.value };
                update("services", { ...content.services, items });
              }}
            />
          </Field>
          <div className="flex gap-2">
            <button className="studio-secondary" type="button" onClick={() => moveService(index, -1)}>上移</button>
            <button className="studio-secondary" type="button" onClick={() => moveService(index, 1)}>下移</button>
          </div>
        </fieldset>
      ))}
      <Field label="聯絡標題">
        <input value={content.contact.title} onChange={(event) => update("contact", { ...content.contact, title: event.target.value })} />
      </Field>
      <Field label="聯絡描述">
        <textarea value={content.contact.description} onChange={(event) => update("contact", { ...content.contact, description: event.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="聯絡按鈕文字">
          <input value={content.contact.buttonLabel} onChange={(event) => update("contact", { ...content.contact, buttonLabel: event.target.value })} />
        </Field>
        <Field label="聯絡按鈕連結">
          <input value={content.contact.buttonHref} onChange={(event) => update("contact", { ...content.contact, buttonHref: event.target.value })} />
        </Field>
      </div>
      <Field label="頁尾">
        <input value={content.footer.text} onChange={(event) => update("footer", { text: event.target.value })} />
      </Field>
      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">區塊順序</legend>
        {content.layout.order.map((section, index) => (
          <div className="flex items-center justify-between gap-3" key={section}>
            <span>{index + 1}. {sectionNames[section]}</span>
            <span className="flex gap-2">
              <button className="studio-secondary" type="button" onClick={() => moveSection(index, -1)}>上移</button>
              <button className="studio-secondary" type="button" onClick={() => moveSection(index, 1)}>下移</button>
            </span>
          </div>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="背景" value={content.theme.background} options={BACKGROUND_OPTIONS} labels={themeOptionLabels.background} onChange={(background) => update("theme", { ...content.theme, background })} />
        <SelectField label="文字" value={content.theme.text} options={TEXT_OPTIONS} labels={themeOptionLabels.text} onChange={(text) => update("theme", { ...content.theme, text })} />
        <SelectField label="強調色" value={content.theme.accent} options={ACCENT_OPTIONS} labels={themeOptionLabels.accent} onChange={(accent) => update("theme", { ...content.theme, accent })} />
        <SelectField label="字體" value={content.theme.font} options={FONT_OPTIONS} labels={themeOptionLabels.font} onChange={(font) => update("theme", { ...content.theme, font })} />
        <SelectField label="圓角" value={content.theme.radius} options={RADIUS_OPTIONS} labels={themeOptionLabels.radius} onChange={(radius) => update("theme", { ...content.theme, radius })} />
        <SelectField label="密度" value={content.theme.density} options={DENSITY_OPTIONS} labels={themeOptionLabels.density} onChange={(density) => update("theme", { ...content.theme, density })} />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-stone-700">
      {label}
      {children}
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </Field>
  );
}
