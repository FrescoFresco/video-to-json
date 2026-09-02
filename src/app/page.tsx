"use client";

import { StudioApp } from "@/components/studio/studio-app";
import { StudioProvider } from "@/lib/store";

export default function Page() {
  return (
    <StudioProvider>
      <StudioApp />
    </StudioProvider>
  );
}
