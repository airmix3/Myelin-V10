import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * PATCH /api/strategy/directions/[directionId]/goals/[goalId]/seeds/[seedId]
 * Update a task seed.
 * Body: { title?, description?, suggestedDepartment?, roughScope?, dependencies?, strategicContext?, status? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { directionId: string; goalId: string; seedId: string } },
) {
  try {
    const body = await request.json();
    const { title, description, suggestedDepartment, roughScope, dependencies, strategicContext, status } = body;

    const data: Record<string, string | null> = { updatedAt: new Date().toISOString() };
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (suggestedDepartment !== undefined) data.suggestedDepartment = suggestedDepartment;
    if (roughScope !== undefined) data.roughScope = roughScope;
    if (dependencies !== undefined) data.dependencies = dependencies;
    if (strategicContext !== undefined) data.strategicContext = strategicContext;
    if (status !== undefined) data.status = status;

    const updated = await prisma.taskSeed.update({
      where: { id: params.seedId },
      data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to update seed', detail: String(err) },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/strategy/directions/[directionId]/goals/[goalId]/seeds/[seedId]
 * Delete a task seed.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { directionId: string; goalId: string; seedId: string } },
) {
  try {
    await prisma.taskSeed.delete({ where: { id: params.seedId } });
    return new Response(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to delete seed', detail: String(err) },
      { status: 500 },
    );
  }
}
