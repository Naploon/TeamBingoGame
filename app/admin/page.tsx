import { AdminIndex } from "@/components/admin-index";
import { AppSurface, Panel, SectionHeading } from "@/components/ui";
import { requireAdminUser } from "@/lib/auth/admin";
import { listEvents } from "@/lib/game/service";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdminUser();
  const events = await listEvents();

  return (
    <AppSurface className="space-y-6">
      <Panel className="bg-gradient-to-r from-white via-white to-sand/50">
        <SectionHeading
          eyebrow="Control room"
          title="Manage your bingo challenge events"
          description="Create a fresh event, open registrations, and jump into any existing dashboard."
        />
      </Panel>
      <AdminIndex initialEvents={events} />
    </AppSurface>
  );
}
