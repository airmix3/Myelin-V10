import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [activeAgents, totalAgents, tasksCompleted, deliverablesCount] = await Promise.all([
      prisma.employee.count({ where: { status: 'active' } }),
      prisma.employee.count(),
      prisma.task.count({ where: { state: 'completed' } }),
      prisma.deliverable.count(),
    ]);

    // Uptime: calculate from process start time
    const uptimeMs = process.uptime() * 1000;
    const uptimeHours = Math.floor(uptimeMs / 3600000);
    const uptimeMins = Math.floor((uptimeMs % 3600000) / 60000);
    const uptime = uptimeHours > 0 ? `${uptimeHours}h ${uptimeMins}m` : `${uptimeMins}m`;

    return NextResponse.json({
      activeAgents,
      totalAgents,
      tasksCompleted,
      deliverablesCount,
      uptime,
    });
  } catch {
    return NextResponse.json(
      { activeAgents: 0, totalAgents: 0, tasksCompleted: 0, deliverablesCount: 0, uptime: '0m' },
      { status: 200 },
    );
  }
}
