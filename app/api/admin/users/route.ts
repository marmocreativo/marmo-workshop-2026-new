import { adminAuthed, handle } from "@/lib/api";
import { query } from "@/lib/db";

export type AdminUser = {
  id: string;
  email: string;
  role: string;
  tokens: number;
  plan_id: string | null;
  sub_status: string | null;
  created_at: number;
};

export const GET = handle(async (req: Request) => {
  await adminAuthed();
  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const users = await query<AdminUser>(
    `SELECT id,email,role,tokens,plan_id,sub_status,created_at FROM users
     WHERE ? = '' OR email LIKE ? ORDER BY created_at DESC LIMIT 100`,
    [q, `%${q}%`],
  );
  return Response.json({ users });
});
