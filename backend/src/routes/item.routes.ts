import { Router } from 'express';
import { getItems, addItem, updateItem, deleteItem, scanItem } from '../controllers/item.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireHouseholdMember } from '../middleware/householdAuth.js';

export const itemRouter = Router({ mergeParams: true });

itemRouter.use(authMiddleware);
itemRouter.use(requireHouseholdMember);

itemRouter.get('/', getItems);
itemRouter.post('/', addItem);
itemRouter.patch('/:itemId', updateItem);
itemRouter.delete('/:itemId', deleteItem);
itemRouter.post('/scan', scanItem);
