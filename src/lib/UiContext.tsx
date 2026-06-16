"use client";

import { createContext, useContext, useState } from "react";

interface UiCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
}
const Ctx = createContext<UiCtx | null>(null);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}

export function useUi(): UiCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useUi must be used within <UiProvider>");
  return c;
}
