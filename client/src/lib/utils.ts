import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type AvatarColor = {
  bg: string;
  text: string;
  bgHex: string;
  textHex: string;
};

/** Soft pastels — Nova / default templates */
const PASTEL_AVATAR_COLORS: AvatarColor[] = [
  { bg: 'bg-pink-100', text: 'text-pink-700', bgHex: '#fdf2f8', textHex: '#be185d' },
  { bg: 'bg-purple-100', text: 'text-purple-700', bgHex: '#faf5ff', textHex: '#7e22ce' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', bgHex: '#eef2ff', textHex: '#4338ca' },
  { bg: 'bg-blue-100', text: 'text-blue-700', bgHex: '#eff6ff', textHex: '#1d4ed8' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', bgHex: '#ecfeff', textHex: '#0e7490' },
  { bg: 'bg-teal-100', text: 'text-teal-700', bgHex: '#f0fdfa', textHex: '#0f766e' },
  { bg: 'bg-green-100', text: 'text-green-700', bgHex: '#f0fdf4', textHex: '#15803d' },
  { bg: 'bg-lime-100', text: 'text-lime-700', bgHex: '#f7feee', textHex: '#4d7c0f' },
  { bg: 'bg-yellow-100', text: 'text-yellow-700', bgHex: '#fefce8', textHex: '#a16207' },
  { bg: 'bg-amber-100', text: 'text-amber-700', bgHex: '#fffbeb', textHex: '#b45309' },
  { bg: 'bg-orange-100', text: 'text-orange-700', bgHex: '#fff7ed', textHex: '#c2410c' },
  { bg: 'bg-rose-100', text: 'text-rose-700', bgHex: '#fff1f2', textHex: '#be123c' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', bgHex: '#fdf4ff', textHex: '#a21caf' },
  { bg: 'bg-violet-100', text: 'text-violet-700', bgHex: '#f5f3ff', textHex: '#6d28d9' },
  { bg: 'bg-sky-100', text: 'text-sky-700', bgHex: '#f0f9ff', textHex: '#0369a1' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', bgHex: '#ecfdf5', textHex: '#047857' },
];

/**
 * Atlas (helicoptic-v1) — saturated solid fills + light initials (Rh Emerald Figma).
 * Includes greens / slates / cyan from the design palette (#64748B, #0F172A, #16A34A, …).
 */
const ATLAS_AVATAR_COLORS: AvatarColor[] = [
  { bg: 'bg-slate-600', text: 'text-slate-50', bgHex: '#64748B', textHex: '#F8FAFC' },
  { bg: 'bg-slate-900', text: 'text-slate-50', bgHex: '#0F172A', textHex: '#F8FAFC' },
  { bg: 'bg-green-600', text: 'text-white', bgHex: '#16A34A', textHex: '#FFFFFF' },
  { bg: 'bg-emerald-500', text: 'text-white', bgHex: '#10B981', textHex: '#FFFFFF' },
  { bg: 'bg-cyan-500', text: 'text-white', bgHex: '#06B6D4', textHex: '#FFFFFF' },
  { bg: 'bg-slate-600', text: 'text-slate-50', bgHex: '#475569', textHex: '#F8FAFC' },
  { bg: 'bg-violet-600', text: 'text-white', bgHex: '#7C3AED', textHex: '#FFFFFF' },
  { bg: 'bg-orange-600', text: 'text-white', bgHex: '#EA580C', textHex: '#FFFFFF' },
  { bg: 'bg-blue-600', text: 'text-white', bgHex: '#2563EB', textHex: '#FFFFFF' },
  { bg: 'bg-emerald-700', text: 'text-white', bgHex: '#047857', textHex: '#FFFFFF' },
  { bg: 'bg-fuchsia-700', text: 'text-white', bgHex: '#A21CAF', textHex: '#FFFFFF' },
  { bg: 'bg-rose-600', text: 'text-white', bgHex: '#E11D48', textHex: '#FFFFFF' },
  { bg: 'bg-teal-600', text: 'text-white', bgHex: '#0D9488', textHex: '#FFFFFF' },
  { bg: 'bg-indigo-600', text: 'text-white', bgHex: '#4F46E5', textHex: '#FFFFFF' },
  { bg: 'bg-amber-600', text: 'text-white', bgHex: '#D97706', textHex: '#FFFFFF' },
  { bg: 'bg-sky-600', text: 'text-white', bgHex: '#0284C7', textHex: '#FFFFFF' },
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function isAtlasPanelTemplate(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.panelTemplate === "helicoptic-v1";
}

/**
 * Generates an avatar color for a name.
 * Atlas (Emerald) uses dark saturated fills + light initials; Nova/default keep pastels.
 */
export function getPastelColorForName(name: string): { 
  bg: string; 
  text: string; 
  bgStyle: string; 
  textStyle: string;
} {
  const palette = isAtlasPanelTemplate() ? ATLAS_AVATAR_COLORS : PASTEL_AVATAR_COLORS;
  const color = palette[hashName(name || "?") % palette.length];
  return {
    bg: color.bg,
    text: color.text,
    bgStyle: color.bgHex,
    textStyle: color.textHex,
  };
}

/** Pastel card backgrounds matching Help Topics style: lavender, mint, beige, rose */
const PASTEL_CARD_BG = [
  "#E8EBF4", // light lavender
  "#E8F4E8", // light mint
  "#F4EEDF", // light beige
  "#F4E8E8", // light rose
] as const;

export function getPastelCardBgForName(name: string): string {
  return PASTEL_CARD_BG[hashName(name) % PASTEL_CARD_BG.length];
}
