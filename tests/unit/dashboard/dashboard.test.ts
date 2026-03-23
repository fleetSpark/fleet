import { describe, it, expect } from 'vitest';

// Dashboard components are React/Ink components.
// Smoke-test: verify they are importable and the command registers correctly.

describe('Dashboard', () => {
  it('dashboard command module exports registerDashboardCommand', async () => {
    const mod = await import('../../../packages/cli/dist/commands/dashboard.js');
    expect(typeof mod.registerDashboardCommand).toBe('function');
  });

  it('App component module exports App', async () => {
    const mod = await import('../../../packages/cli/dist/dashboard/App.js');
    expect(typeof mod.App).toBe('function');
  });

  it('MissionBoard component module exports MissionBoard', async () => {
    const mod = await import('../../../packages/cli/dist/dashboard/MissionBoard.js');
    expect(typeof mod.MissionBoard).toBe('function');
  });

  it('ShipHealth component module exports ShipHealth', async () => {
    const mod = await import('../../../packages/cli/dist/dashboard/ShipHealth.js');
    expect(typeof mod.ShipHealth).toBe('function');
  });

  it('LogViewer component module exports LogViewer', async () => {
    const mod = await import('../../../packages/cli/dist/dashboard/LogViewer.js');
    expect(typeof mod.LogViewer).toBe('function');
  });
});
