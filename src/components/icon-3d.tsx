import type { CSSProperties } from "react";
export type IconName = "learn" | "play" | "talk" | "star" | "happy" | "sad" | "tired" | "bear";
export default function Icon3D({ name, size = 56, className = "" }: { name: IconName; size?: number; className?: string }) {
  return <img className={`icon-3d ${className}`} src={`/icons/${name}.webp`} alt="" aria-hidden="true" width={size} height={size} loading="lazy" decoding="async" draggable={false} style={{ "--icon-size": `${size}px` } as CSSProperties} />;
}
