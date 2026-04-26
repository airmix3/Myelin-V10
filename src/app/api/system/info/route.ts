import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    nodeVersion: process.version,
    platform: process.platform,
    dbPath: 'data/myelin.db',
    runtime: 'Next.js 14 (App Router)',
    workerStatus: 'running', // Worker is always running when server is up
    langfuseStatus: process.env.LANGFUSE_PUBLIC_KEY ? 'active' : 'inactive',
  });
}
