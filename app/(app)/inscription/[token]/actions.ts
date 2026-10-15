"use server";

import { createAccount, type SignupState } from "@/lib/signup";

export async function signup(token: string, _previous: SignupState, formData: FormData): Promise<SignupState> {
  const read = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return createAccount(token, { nom: read("nom"), password: read("password"), confirm: read("confirm") });
}
