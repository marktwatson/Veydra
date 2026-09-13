import { supabase } from "@/lib/supabase";

export interface ApplyAuthResult {
  user: { id: string } | null;
}

/**
 * Signs up a new contractor applicant. If Supabase auth reports the email
 * as "already registered" — typically because a prior application attempt
 * created the login but failed before the contractor profile was saved —
 * this tries signing in with the same password. If it matches, the
 * orphaned account belongs to this applicant and we can proceed to create
 * their profile instead of blocking them with a false "already exists".
 */
export async function signUpApplicant(
  email: string,
  password: string,
  fullName: string,
): Promise<ApplyAuthResult> {
  const signUpResult = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: "contractor",
      },
    },
  });

  if (!signUpResult.error) {
    return { user: signUpResult.data.user };
  }

  const msg = signUpResult.error.message || "";
  const isAlreadyRegistered =
    /already registered|already exists|already been registered/i.test(msg);

  if (!isAlreadyRegistered) {
    throw new Error(msg);
  }

  const signInResult = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInResult.error || !signInResult.data.user) {
    throw new Error(
      "An account with this email already exists, but the password you entered doesn't match. If you started an application before, use 'Forgot Password' on the login page to reset it, or contact support.",
    );
  }

  return { user: signInResult.data.user };
}
