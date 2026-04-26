import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest, { params }: { params: { skillId: string } }) {
  try {
    const skill = await prisma.skill.update({
      where: { id: params.skillId },
      data: { status: 'approved' },
    });
    return NextResponse.json({ skill });
  } catch (error) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }
}
