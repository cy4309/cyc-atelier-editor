"use client";

import { useState } from "react";
import type { SiteContent } from "@/lib/content/schema";
import { themeOptionLabels, themeStyle } from "@/lib/content/theme";

const sectionTitle = {
  about: "品牌介紹",
  services: "服務",
  contact: "聯絡",
} as const;

export function SiteView({ content }: { content: SiteContent }) {
  const theme = content.theme;
  return (
    <div className="site-root" style={themeStyle(theme)}>
      <header className="site-header">
        <a className="site-brand" href="#top">
          {content.brand.name}
        </a>
        <nav className="site-nav" aria-label="主要導覽">
          {content.brand.nav.map((item) => (
            <a key={`${item.label}-${item.href}`} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <main id="top">
        <section className="site-hero" aria-labelledby="hero-title">
          <div className="site-hero-copy">
            <p className="site-eyebrow">{content.hero.eyebrow}</p>
            <h1 id="hero-title">{content.hero.title}</h1>
            <p className="site-lead">{content.hero.description}</p>
            <a className="site-button" href={content.hero.buttonHref}>
              {content.hero.buttonLabel}
            </a>
          </div>
          <SafeImage src={content.hero.imageUrl} alt={content.hero.imageAlt} />
        </section>
        {content.layout.order.map((section) => {
          if (section === "about") {
            return (
              <section className="site-section site-about" id="about" key="about" aria-labelledby="about-title">
                <SafeImage src={content.about.imageUrl} alt={content.about.imageAlt} />
                <div>
                  <p className="site-kicker">{sectionTitle.about}</p>
                  <h2 id="about-title">{content.about.title}</h2>
                  {content.about.body.split("\n").filter(Boolean).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            );
          }
          if (section === "services") {
            return (
              <section className="site-section" id="services" key="services" aria-labelledby="services-title">
                <div className="site-section-heading">
                  <p className="site-kicker">{sectionTitle.services}</p>
                  <h2 id="services-title">{content.services.title}</h2>
                </div>
                <div className="site-cards">
                  {content.services.items.map((item, index) => (
                    <article className="site-card" key={item.id}>
                      <span>0{index + 1}</span>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </article>
                  ))}
                </div>
              </section>
            );
          }
          return (
            <section className="site-section site-contact" id="contact" key="contact" aria-labelledby="contact-title">
              <p className="site-kicker">{sectionTitle.contact}</p>
              <h2 id="contact-title">{content.contact.title}</h2>
              <p>{content.contact.description}</p>
              <a className="site-button" href={content.contact.buttonHref}>
                {content.contact.buttonLabel}
              </a>
            </section>
          );
        })}
      </main>
      <footer className="site-footer">{content.footer.text}</footer>
      <p className="sr-only">
        主題：{themeOptionLabels.background[theme.background]}、{themeOptionLabels.font[theme.font]}
      </p>
    </div>
  );
}

function SafeImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="site-image site-image-fallback" role="img" aria-label={alt}>
        <span>CYC</span>
        <small>圖片暫時無法顯示</small>
      </div>
    );
  }
  return (
    // 業主可換成任意 https 圖片，失敗時要改顯示佔位，因此不走 next/image 遠端白名單。
    // eslint-disable-next-line @next/next/no-img-element
    <img className="site-image" src={src} alt={alt} onError={() => setFailed(true)} />
  );
}
