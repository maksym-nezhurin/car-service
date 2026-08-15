import { finishSyncRun, startSyncRun } from './sync-run.utils';

function makePrismaMock() {
  return {
    catalogSyncRun: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('startSyncRun', () => {
  it('creates a running row and returns its id', async () => {
    const prisma = makePrismaMock();
    prisma.catalogSyncRun.create.mockResolvedValue({ id: 'run-1' });

    const runId = await startSyncRun(prisma, 'catalog:sync:autoria', 'hyundai');

    expect(runId).toBe('run-1');
    expect(prisma.catalogSyncRun.create).toHaveBeenCalledWith({
      data: { script: 'catalog:sync:autoria', scopeMakeSlug: 'hyundai', status: 'running' },
    });
  });

  it('defaults scopeMakeSlug to null for a full run', async () => {
    const prisma = makePrismaMock();
    prisma.catalogSyncRun.create.mockResolvedValue({ id: 'run-2' });

    await startSyncRun(prisma, 'catalog:link:engines');

    expect(prisma.catalogSyncRun.create).toHaveBeenCalledWith({
      data: { script: 'catalog:link:engines', scopeMakeSlug: null, status: 'running' },
    });
  });
});

describe('finishSyncRun', () => {
  it('marks success with stats', async () => {
    const prisma = makePrismaMock();

    await finishSyncRun(prisma, 'run-1', 'success', { stats: { makes: 42 } });

    expect(prisma.catalogSyncRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: { status: 'success', finishedAt: expect.any(Date), stats: { makes: 42 } },
    });
  });

  it('marks failed with an error message, no stats key when omitted', async () => {
    const prisma = makePrismaMock();

    await finishSyncRun(prisma, 'run-1', 'failed', { errorMessage: 'boom' });

    expect(prisma.catalogSyncRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: { status: 'failed', finishedAt: expect.any(Date), errorMessage: 'boom' },
    });
  });

  it('marks partial (AUTO.RIA hourly-limit stop) distinctly from failed', async () => {
    const prisma = makePrismaMock();

    await finishSyncRun(prisma, 'run-1', 'partial', { errorMessage: 'hourly limit reached' });

    expect(prisma.catalogSyncRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'partial' }) }),
    );
  });

  it('sends no stats/errorMessage keys at all when neither is provided', async () => {
    const prisma = makePrismaMock();

    await finishSyncRun(prisma, 'run-1', 'success');

    expect(prisma.catalogSyncRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: { status: 'success', finishedAt: expect.any(Date) },
    });
  });
});
