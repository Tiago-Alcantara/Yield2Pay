"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "#veredito", label: "Veredito" },
  { href: "#hoje", label: "Os dois repos" },
  { href: "#desenho", label: "Desenho" },
  { href: "#vista-nucleo", label: "Núcleo" },
  { href: "#alvo", label: "Arquitetura" },
  { href: "#ports", label: "Ports" },
  { href: "#dados", label: "Dados" },
  { href: "#plano", label: "Plano" },
];

export function SiteNav() {
  const [active, setActive] = useState("#veredito");

  useEffect(() => {
    const ids = links.map((l) => l.href.slice(1));
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(`#${visible.target.id}`);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.1, 0.3, 0.6] },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <a href="#veredito" className="font-mono text-xs tracking-[0.2em] text-primary">
          YIELD2PAY · MULTICHAIN
        </a>
        <nav className="hidden gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-full px-3 py-1 text-sm transition-colors",
                active === l.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
