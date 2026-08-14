import { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { generateInviteCode } from '../lib/inviteCode.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export async function createHousehold(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { name } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'Household name is required' });
      return;
    }

    let inviteCode = generateInviteCode();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const existing = await prisma.household.findUnique({ where: { inviteCode } });
      if (!existing) {
        isUnique = true;
      } else {
        inviteCode = generateInviteCode();
        attempts++;
      }
    }

    if (!isUnique) {
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to generate unique invite code' });
      return;
    }

    const household = await prisma.household.create({
      data: {
        name: name.trim(),
        inviteCode,
        createdByUserId: userId,
        members: {
          create: {
            userId,
            role: 'owner',
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, displayName: true },
            },
          },
        },
      },
    });

    res.status(201).json({
      message: 'Household created successfully',
      household,
    });
  } catch (error) {
    console.error('[Household Controller Create Error]:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create household' });
  }
}

export async function joinHousehold(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { inviteCode } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    if (!inviteCode || typeof inviteCode !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'Invite code is required' });
      return;
    }

    const cleanCode = inviteCode.trim().toUpperCase();

    const household = await prisma.household.findUnique({
      where: { inviteCode: cleanCode },
    });

    if (!household) {
      res.status(404).json({ error: 'Not Found', message: 'Invalid invite code' });
      return;
    }

    const existingMember = await prisma.householdMember.findUnique({
      where: {
        userId_householdId: {
          userId,
          householdId: household.id,
        },
      },
    });

    if (existingMember) {
      res.status(200).json({
        message: 'Already a member of this household',
        household,
      });
      return;
    }

    const member = await prisma.householdMember.create({
      data: {
        userId,
        householdId: household.id,
        role: 'member',
      },
      include: {
        household: true,
      },
    });

    res.status(200).json({
      message: 'Joined household successfully',
      household: member.household,
    });
  } catch (error) {
    console.error('[Household Controller Join Error]:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to join household' });
  }
}

export async function getHousehold(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rawId = req.params.id;
    const householdId = Array.isArray(rawId) ? rawId[0] : rawId;

    const household = await prisma.household.findUnique({
      where: { id: householdId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, displayName: true },
            },
          },
        },
      },
    });

    if (!household) {
      res.status(404).json({ error: 'Not Found', message: 'Household not found' });
      return;
    }

    res.status(200).json({ household });
  } catch (error) {
    console.error('[Household Controller Get Error]:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch household details' });
  }
}
