import type { Metadata } from "next";
import { connection } from "next/server";
import { AdminStudio, type StudioInitial } from "@/components/admin/admin-studio";
import { getRepository } from "@/lib/repository";
import { aiConfigured } from "@/lib/server/ai";
import { adminAccess } from "@/lib/server/auth";
import { presentState } from "@/lib/server/editor";

export const metadata: Metadata = {
  title: "編輯器 · CYC Atelier",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  await connection();
  const access = await adminAccess();
  if (!access.ok) {
    return (
      <AdminStudio
        initial={null}
        needsLogin={access.code === "UNAUTHORIZED"}
        bootError={access.code === "UNAUTHORIZED" ? "" : access.error}
      />
    );
  }

  let initial: StudioInitial | null = null;
  let bootError = "";
  try {
    const state = await (await getRepository()).getState();
    initial = {
      ...(await presentState(state)),
      devBypass: access.devBypass,
      aiConfigured: await aiConfigured(),
    };
  } catch (error) {
    bootError = error instanceof Error ? error.message : "無法讀取內容";
  }

  if (!initial) {
    return <AdminStudio initial={null} needsLogin={false} bootError={bootError || "無法讀取內容"} />;
  }
  return <AdminStudio needsLogin={false} initial={initial} />;
}
