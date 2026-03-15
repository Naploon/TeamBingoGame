import { AdminDashboard } from "@/components/admin-dashboard";
import { AppSurface } from "@/components/ui";
import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminEventState } from "@/lib/game/service";

export const dynamic = "force-dynamic";

export default async function AdminEventPage({
  params,
}: {
  params: { slug: string };
}) {
  await requireAdminUser();
  const state = await getAdminEventState(params.slug);

  return (
    <AppSurface>
      <AdminDashboard slug={params.slug} initialState={state} />
    </AppSurface>
  );
}
