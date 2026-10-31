import { safeNextPath } from "@/lib/auth/next-path";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthShell mode="login" next={next}>
      <LoginForm next={safeNextPath(next)} />
    </AuthShell>
  );
}
