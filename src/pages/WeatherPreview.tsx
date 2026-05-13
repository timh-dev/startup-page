import React from "react";
import { Link } from "react-router-dom";
import { HiArrowLeft } from "react-icons/hi2";
import { WeatherBox } from "@/features/weather/components/WeatherBox";

export default function WeatherPreviewPage() {
  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="fixed top-6 left-6 z-[10000]">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          <HiArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
      <div className="flex min-h-screen items-center justify-center p-6">
        <WeatherBox />
      </div>
    </div>
  );
}
