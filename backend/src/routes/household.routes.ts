import { Router } from 'express';
import { createHousehold, joinHousehold, getHousehold } from '../controllers/household.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireHouseholdMember } from '../middleware/householdAuth.js';

export const householdRouter = Router();

householdRouter.use(authMiddleware);

householdRouter.post('/', createHousehold);
householdRouter.post('/join', joinHousehold);
householdRouter.get('/:id', requireHouseholdMember, getHousehold);
