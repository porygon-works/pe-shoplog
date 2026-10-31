import { safeNextPath } from "@/lib/auth/next-path";
import { AuthShell } from "../auth-shell";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthShell mode="signup" next={next}>
      <SignupForm next={safeNextPath(next)} />
    </AuthShell>
  );
}
