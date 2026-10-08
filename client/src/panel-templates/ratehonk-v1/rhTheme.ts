import { tokens } from "./tokens";

/** Shared Tailwind classes for RateHonk primary actions (use when skin branching in TS). */
export const rhBtnPrimary =
  "bg-[var(--rh-brand)] hover:bg-[var(--rh-brand-hover)] text-white rounded-xl shadow-sm";

export const rhBtnOutline =
  "border border-[var(--rh-brand)] text-[var(--rh-brand)] hover:bg-[var(--rh-brand-light)] rounded-xl bg-white";

export const rhPageTitle = "text-[30px] font-semibold leading-[38px] tracking-[-0.6px] text-[#111c2d]";

export const rhMuted = "text-[#717786]";

export const rhBrand = tokens.colors.brand;

/** Standard page padding / width for RateHonk pages (use on root page div). */
export const rhPageShell =
  "rh-page-shell w-full max-w-full px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8";
