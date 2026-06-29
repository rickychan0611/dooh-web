"use client";

import { useEffect, useState } from "react";

const INTERVAL_MS = 2000;
const VISIBLE_CARDS = 4;

export function HeroStackSlider({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      setActive((current) => (current + 1) % images.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [images.length]);

  if (!images.length) return <div className="hero-stack" aria-hidden />;

  return (
    <div className="hero-stack" aria-hidden>
      {images.map((src, index) => {
        const pos = (index - active + images.length) % images.length;
        const isBack = pos === images.length - 1;
        return (
          <img
            key={src}
            src={src}
            alt=""
            className="hero-stack-card"
            style={{
              zIndex: images.length - pos,
              opacity: pos < VISIBLE_CARDS ? 1 : 0,
              transform: `translate3d(calc(var(--stack-offset-x) * ${pos}), calc(var(--stack-offset-y) * ${pos}), 0) scale(${1 - pos * 0.07}) rotate(${pos * -2.5}deg)`,
              transition: isBack ? "none" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
