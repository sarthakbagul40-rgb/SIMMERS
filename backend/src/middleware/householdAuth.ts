import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';
import { prisma } from '../lib/prisma.js';

export async function requireHouseholdMember(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;
    const rawHouseholdId = req.params.id || req.params.householdId;
    const householdId = Array.isArray(rawHouseholdId) ? rawHouseholdId[0] : rawHouseholdId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    if (!householdId || typeof householdId !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'Household ID parameter missing' });
      return;
    }

    const membership = await prisma.householdMember.findUnique({
      where: {
        userId_householdId: {
          userId,
          householdId,
        },
      },
    });

    if (!membership) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You are not a member of this household',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('[Household Member Guard Error]:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Authorization check failed' });
  }
}
