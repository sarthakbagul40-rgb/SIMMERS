import { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { scanPantryImage } from '../services/gemini.service.js';

function parseParam(param: string | string[] | undefined): string {
  if (!param) return '';
  return Array.isArray(param) ? param[0] : param;
}

export async function getItems(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const householdId = parseParam(req.params.id || req.params.householdId);

    const items = await prisma.pantryItem.findMany({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
      include: {
        addedBy: {
          select: { id: true, email: true, displayName: true },
        },
      },
    });

    res.status(200).json({ items });
  } catch (error) {
    console.error('[Item Controller GetItems Error]:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch pantry items' });
  }
}

export async function addItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const householdId = parseParam(req.params.id || req.params.householdId);
    const { name, quantity, unit, expiryDate } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'Item name is required' });
      return;
    }

    const item = await prisma.pantryItem.create({
      data: {
        householdId,
        name: name.trim(),
        quantity: typeof quantity === 'number' ? quantity : 1.0,
        unit: typeof unit === 'string' ? unit.trim() : 'pcs',
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        addedByUserId: userId,
      },
      include: {
        addedBy: {
          select: { id: true, email: true, displayName: true },
        },
      },
    });

    // Optional: Log XP for adding an item
    await prisma.xPLog.create({
      data: {
        userId,
        householdId,
        action: 'item_added',
        xpAmount: 10,
      },
    });

    res.status(201).json({
      message: 'Pantry item added successfully',
      item,
    });
  } catch (error) {
    console.error('[Item Controller AddItem Error]:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to add pantry item' });
  }
}

export async function updateItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const householdId = parseParam(req.params.id || req.params.householdId);
    const itemId = parseParam(req.params.itemId);
    const { name, quantity, unit, expiryDate } = req.body;

    const existing = await prisma.pantryItem.findFirst({
      where: { id: itemId, householdId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Not Found', message: 'Pantry item not found in this household' });
      return;
    }

    const updated = await prisma.pantryItem.update({
      where: { id: itemId },
      data: {
        ...(name && typeof name === 'string' ? { name: name.trim() } : {}),
        ...(typeof quantity === 'number' ? { quantity } : {}),
        ...(unit && typeof unit === 'string' ? { unit: unit.trim() } : {}),
        ...(expiryDate !== undefined ? { expiryDate: expiryDate ? new Date(expiryDate) : null } : {}),
      },
      include: {
        addedBy: {
          select: { id: true, email: true, displayName: true },
        },
      },
    });

    res.status(200).json({
      message: 'Pantry item updated successfully',
      item: updated,
    });
  } catch (error) {
    console.error('[Item Controller UpdateItem Error]:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update pantry item' });
  }
}

export async function deleteItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const householdId = parseParam(req.params.id || req.params.householdId);
    const itemId = parseParam(req.params.itemId);

    const existing = await prisma.pantryItem.findFirst({
      where: { id: itemId, householdId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Not Found', message: 'Pantry item not found in this household' });
      return;
    }

    await prisma.pantryItem.delete({
      where: { id: itemId },
    });

    res.status(200).json({
      message: 'Pantry item deleted successfully',
      deletedItemId: itemId,
    });
  } catch (error) {
    console.error('[Item Controller DeleteItem Error]:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete pantry item' });
  }
}

export async function scanItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { image } = req.body;

    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'Base64 image string is required' });
      return;
    }

    const scanResult = await scanPantryImage(image);

    res.status(200).json({
      message: 'Image scan completed',
      result: scanResult,
    });
  } catch (error) {
    console.error('[Item Controller ScanItem Error]:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to scan image' });
  }
}
