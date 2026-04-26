/**
 * Dynamic department registry — replaces hardcoded department lists.
 *
 * Reads active departments from the employees table at runtime.
 * Results are cached in-memory and invalidated via invalidateDepartmentCache().
 *
 * Per D-14: Full dynamic organs. No department count limit.
 * Per ONB-08: Department list read from DB, not hardcoded.
 */

import { prisma } from '@/lib/db';

let _departments: string[] | null = null;
let _deptHeadMap: Record<string, string> | null = null;

/**
 * Get active departments from DB (excludes 'cos').
 * Cached in-memory, invalidated via invalidateDepartmentCache().
 */
export async function getActiveDepartments(): Promise<string[]> {
  if (_departments) return _departments;
  const employees = await prisma.employee.findMany({
    where: { role: 'executive', status: 'active' },
    select: { department: true },
  });
  _departments = [...new Set(employees.map(e => e.department))].filter(d => d !== 'cos');
  return _departments;
}

/**
 * Get all departments including 'cos'.
 */
export async function getAllDepartments(): Promise<string[]> {
  const depts = await getActiveDepartments();
  return ['cos', ...depts];
}

/**
 * Get the department head's agentId for a department.
 */
export async function getDepartmentHead(department: string): Promise<string | undefined> {
  if (!_deptHeadMap) {
    const employees = await prisma.employee.findMany({
      where: { role: 'executive', status: 'active' },
      select: { department: true, agentId: true },
    });
    _deptHeadMap = {};
    for (const emp of employees) {
      if (emp.agentId) {
        _deptHeadMap[emp.department] = emp.agentId;
      }
    }
  }
  return _deptHeadMap[department];
}

/**
 * Invalidate the cached department list. Call after creating new departments.
 */
export function invalidateDepartmentCache(): void {
  _departments = null;
  _deptHeadMap = null;
}
