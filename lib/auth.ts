import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { batch, one, query, run, uid } from "./db";
import { DEFAULT_CATEGORIES } from "./defaults";

const COOKIE = "mw_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-only-secret-change-me");

export type Role = "user" | "admin";

export type User = {
  id: string;
  email: string;
  role: Role;
  tokens: number;
  plan_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  sub_status: string | null;
  sub_period_end: number | null;
  cancel_at_period_end: number;
};

export async function startSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    await ensureAdmin();
    return one<User>(
      `SELECT id,email,role,tokens,plan_id,stripe_customer_id,stripe_subscription_id,sub_status,sub_period_end,cancel_at_period_end
       FROM users WHERE id=?`,
      [String(payload.sub)],
    );
  } catch {
    return null;
  }
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/studio");
  return user;
}

export const adminEmail = () => (process.env.ADMIN_EMAIL ?? "marmocreativo@gmail.com").toLowerCase();

const g = globalThis as unknown as { __adminReady?: Promise<void> };

// Garantiza que exista el administrador: promueve la cuenta con ADMIN_EMAIL si ya existe,
// o la crea con ADMIN_PASSWORD si todavía no. El registro público nunca otorga este rol.
export function ensureAdmin() {
  return (g.__adminReady ??= (async () => {
    const email = adminEmail();
    const existing = await one<{ id: string; role: string }>("SELECT id,role FROM users WHERE email=?", [email]);
    if (existing) {
      if (existing.role !== "admin") await run("UPDATE users SET role='admin' WHERE id=?", [existing.id]);
      return;
    }
    const password = process.env.ADMIN_PASSWORD;
    if (!password) return;
    const id = uid();
    await run("INSERT INTO users(id,email,password_hash,role,created_at) VALUES(?,?,?,?,?)", [
      id,
      email,
      await bcrypt.hash(password, 10),
      "admin",
      Date.now(),
    ]);
    await seedUser(id);
  })().catch((e) => {
    g.__adminReady = undefined;
    throw e;
  }));
}

/** Solo desarrollo: con BILLING_BYPASS=true no se cobran tokens. Nunca lo actives en producción. */
export const billingBypass = () => process.env.BILLING_BYPASS === "true";

export const hasActiveSubscription = (u: Pick<User, "sub_status">) =>
  u.sub_status === "active" || u.sub_status === "trialing" || u.sub_status === "past_due";

// Agrega a usuarios existentes las categorías por defecto que se añadieron después de su registro.
export async function syncDefaultCategories(userId: string) {
  const have = new Set((await query<{ slug: string }>("SELECT slug FROM categories WHERE user_id=?", [userId])).map((c) => c.slug));
  const missing = DEFAULT_CATEGORIES.filter((c) => !have.has(c.slug));
  if (!missing.length) return;
  const max = await one<{ m: number | null }>("SELECT MAX(sort) AS m FROM categories WHERE user_id=?", [userId]);
  const now = Date.now();
  const stmts: { sql: string; args: (string | number)[] }[] = [];
  missing.forEach((c, i) => {
    const catId = uid();
    stmts.push({
      sql: "INSERT INTO categories(id,user_id,slug,name,sort) VALUES(?,?,?,?,?)",
      args: [catId, userId, c.slug, c.name, (max?.m ?? -1) + 1 + i],
    });
    for (const text of c.modifiers)
      stmts.push({
        sql: "INSERT INTO modifiers(id,user_id,category_id,text,created_at) VALUES(?,?,?,?,?)",
        args: [uid(), userId, catId, text, now],
      });
  });
  await batch(stmts);
}

// Crea las categorías y modificadores iniciales para un usuario nuevo.
export async function seedUser(userId: string) {
  const now = Date.now();
  const stmts: { sql: string; args: (string | number)[] }[] = [];
  DEFAULT_CATEGORIES.forEach((c, i) => {
    const catId = uid();
    stmts.push({
      sql: "INSERT INTO categories(id,user_id,slug,name,sort) VALUES(?,?,?,?,?)",
      args: [catId, userId, c.slug, c.name, i],
    });
    for (const text of c.modifiers) {
      stmts.push({
        sql: "INSERT INTO modifiers(id,user_id,category_id,text,created_at) VALUES(?,?,?,?,?)",
        args: [uid(), userId, catId, text, now],
      });
    }
  });
  await batch(stmts);
}
