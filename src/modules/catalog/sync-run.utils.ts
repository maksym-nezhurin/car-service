/**
 * ETL audit log for the catalog scripts (docs/V1_7_VEHICLE_ENCYCLOPEDIA.md §13.2).
 * Explicit start/finish rather than a wrapping try/finally so each script's own error
 * handling (e.g. sync-autoria's hourly-limit "partial" vs a real failure) decides the
 * final status instead of this module guessing from the thrown error type.
 */

type PrismaLike = {
  catalogSyncRun: {
    create: (args: {
      data: { script: string; scopeMakeSlug: string | null; status: string };
    }) => Promise<{ id: string }>;
    update: (args: {
      where: { id: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { status: string; finishedAt: Date; stats?: any; errorMessage?: string };
    }) => Promise<unknown>;
  };
};

export type SyncRunStatus = 'success' | 'failed' | 'partial';

export async function startSyncRun(
  prisma: PrismaLike,
  script: string,
  scopeMakeSlug?: string | null,
): Promise<string> {
  const run = await prisma.catalogSyncRun.create({
    data: { script, scopeMakeSlug: scopeMakeSlug ?? null, status: 'running' },
  });
  return run.id;
}

export async function finishSyncRun(
  prisma: PrismaLike,
  runId: string,
  status: SyncRunStatus,
  details: { stats?: unknown; errorMessage?: string } = {},
): Promise<void> {
  await prisma.catalogSyncRun.update({
    where: { id: runId },
    data: {
      status,
      finishedAt: new Date(),
      ...(details.stats !== undefined ? { stats: details.stats } : {}),
      ...(details.errorMessage !== undefined ? { errorMessage: details.errorMessage } : {}),
    },
  });
}
