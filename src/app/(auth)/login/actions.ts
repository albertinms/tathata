"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";

export type AuthActionState = { error?: string };

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: error.type === "CredentialsSignin" ? "帳號或密碼錯誤" : "登入失敗，請稍後再試",
      };
    }
    throw error;
  }
}
