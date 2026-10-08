"use client";

import { Link } from "wouter";
import { ArrowLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRatehonkPageSkin } from "@/panel-templates/ratehonk-v1/RatehonkSkinContext";
import { BookingCalendarsPanel } from "@/features/meetings/BookingCalendarsPanel";

export default function MeetingsSettingsPage() {
  useRatehonkPageSkin();
  const outlineClass = "rounded-xl border-[#e5e7eb]";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <div className="atlas-rem-page-hero shrink-0">
        <div className="atlas-rem-page-hero-inner">
          <div className="min-w-0 flex-1">
            <div className="mb-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 -ml-2 gap-1.5 px-2 text-[#717786] hover:text-[#111c2d]"
                asChild
              >
                <Link href="/meetings">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Meetings
                </Link>
              </Button>
            </div>
            <p className="atlas-rem-page-hero-eyebrow">Scheduling</p>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h1 className="atlas-rem-page-hero-title">Meetings settings</h1>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--rh-brand-soft,#ecfdf5)] text-[var(--rh-brand,#047857)]">
                <Settings className="h-4 w-4" />
              </span>
            </div>
            <p className="atlas-rem-page-hero-desc">
              Manage personal booking calendars and public scheduling links.
            </p>
          </div>
        </div>
      </div>

      <div className="w-full min-w-0 shrink-0 pb-8">
        <BookingCalendarsPanel outlineClass={outlineClass} />
      </div>
    </div>
  );
}
