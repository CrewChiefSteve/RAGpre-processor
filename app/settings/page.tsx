import Link from "next/link";
import SettingsForm from "@/components/SettingsForm";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Ensure settings row exists and fetch it
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {}, // uses Prisma defaults from schema
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/jobs"
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          ← Back to Jobs
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Settings
        </h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Configure global defaults for new preprocessing jobs. These values
          pre-fill the Upload form.
        </p>

        <SettingsForm
          initialSettings={{
            ...settings,
            updatedAt: settings.updatedAt.toISOString(),
          }}
        />
      </div>
    </div>
  );
}
