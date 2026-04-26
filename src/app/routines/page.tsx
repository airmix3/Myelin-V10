import { prisma } from '@/lib/db';
import RoutinesClient from './RoutinesClient';

export default async function RoutinesPage() {
  let serialized: Array<Record<string, unknown>> = [];

  try {
    // prisma.routine may be undefined if Prisma client was generated
    // before the Routine model was added — run `npx prisma generate` to fix
    const routineModel = (prisma as unknown as Record<string, unknown>).routine as
      | { findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>> }
      | undefined;

    if (routineModel) {
      const routines = await routineModel.findMany({
        orderBy: { createdAt: 'desc' },
      });
      serialized = routines.map((r) => ({
        ...r,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
        lastRunAt: r.lastRunAt instanceof Date ? r.lastRunAt.toISOString() : r.lastRunAt ?? null,
      }));
    }
  } catch {
    // Routine table may not exist yet — show empty state
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <RoutinesClient routines={serialized as any} />;
}
