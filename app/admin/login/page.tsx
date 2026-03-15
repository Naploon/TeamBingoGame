import { AppSurface } from "@/components/ui";
import { AdminLoginForm } from "@/components/admin-login-form";

export default function AdminLoginPage() {
  return (
    <AppSurface className="flex items-center justify-center">
      <AdminLoginForm />
    </AppSurface>
  );
}
