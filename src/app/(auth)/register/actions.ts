"use server";

import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";

import { db } from "@db/client";
import { users } from "@db/schema";
import { signIn } from "@/auth";

const PASSWORD_MIN_LENGTH = 8;

export type AuthActionState = { error?: string };

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "請輸入 Email 與密碼" };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { error: `密碼至少需 ${PASSWORD_MIN_LENGTH} 碼` };
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return { error: "此 Email 已被註冊" };
  }

  const passwordHash = await hash(password, 12);
  await db.insert(users).values({ email, passwordHash });

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "註冊成功，但自動登入失敗，請改用登入頁面" };
    }
    throw error;
  }
}
