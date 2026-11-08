"use client";

import { type ReactNode } from "react";
import { readPublishedWebsite } from "@/services/rest/websiteContent";
import { useLookup } from "@/services/rest/useLookup";

export function HomeWebsiteContent({ children, usage }: { children: ReactNode; usage: ReactNode }) {
  const { data } = useLookup("website-content", readPublishedWebsite);
  const publishedIntroduction = data?.items.find(item => item.sectionCode === "INTRODUCTION");
  const publishedUsage = data?.items.find(item => item.sectionCode === "USAGE_GUIDE");
  return <>
    {publishedIntroduction && <section className="section-card" aria-labelledby="home-introduction-title">
      <h2 id="home-introduction-title">{publishedIntroduction.title}</h2>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{publishedIntroduction.body}</p>
    </section>}
    {children}
    {publishedUsage ? <section id="huong-dan" className="home-guide" aria-labelledby="home-guide-title">
      <div className="section-introduction"><div><p className="eyebrow">HƯỚNG DẪN</p><h2 id="home-guide-title">{publishedUsage.title}</h2></div></div>
      <p className="section-card" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{publishedUsage.body}</p>
    </section> : usage}
  </>;
}
