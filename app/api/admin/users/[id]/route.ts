import { HttpError, adminAuthed, handle } from "@/lib/api";
import { recentLedger, type Payment } from "@/lib/billing";
import { one, query } from "@/lib/db";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await adminAuthed();
  const { id } = await params;
  const user = await one<{
    id: string;
    email: string;
    role: string;
    tokens: number;
    plan_id: string | null;
    sub_status: string | null;
    sub_period_end: number | null;
    cancel_at_period_end: number;
    created_at: number;
  }>(
    "SELECT id,email,role,tokens,plan_id,sub_status,sub_period_end,cancel_at_period_end,created_at FROM users WHERE id=?",
    [id],
  );
  if (!user) throw new HttpError(404, "Usuario no encontrado");
  const [ledger, payments] = await Promise.all([
    recentLedger(id, 50),
    query<Payment>("SELECT * FROM payments WHERE user_id=? ORDER BY created_at DESC LIMIT 50", [id]),
  ]);
  return Response.json({ user, ledger, payments });
});
