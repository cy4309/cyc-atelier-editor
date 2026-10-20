import { loadEditorState, requireAdmin } from "@/lib/server/editor";

export async function GET() {
  const admin = await requireAdmin();
  if (admin.response) return admin.response;
  return loadEditorState();
}
