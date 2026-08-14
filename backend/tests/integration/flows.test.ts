import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';

describe('SIMMERS API End-to-End Integration Flows', () => {
  let userToken: string;
  let userId: string;
  let secondUserToken: string;
  let householdId: string;
  let inviteCode: string;
  let itemId: string;

  beforeAll(async () => {
    // Clean up test data if any
    try {
      await prisma.xPLog.deleteMany();
      await prisma.pantryItem.deleteMany();
      await prisma.householdMember.deleteMany();
      await prisma.household.deleteMany();
      await prisma.user.deleteMany();
    } catch (e) {
      // Database might not be initialized yet in mock environment
    }
  });

  it('GET /health should return server status 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('simmers-backend');
  });

  it('POST /auth/signup should create a new user and return JWT', async () => {
    const res = await request(app).post('/auth/signup').send({
      email: 'testuser@simmers.app',
      password: 'Password123!',
      displayName: 'Test Chef',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('testuser@simmers.app');

    userToken = res.body.token;
    userId = res.body.user.id;
  });

  it('POST /auth/login should authenticate user and return token', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'testuser@simmers.app',
      password: 'Password123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('GET /auth/me should return current authenticated profile', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userId);
  });

  it('POST /households should create a household and generate invite code', async () => {
    const res = await request(app)
      .post('/households')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Simmers HQ' });

    expect(res.status).toBe(201);
    expect(res.body.household.name).toBe('Simmers HQ');
    expect(res.body.household.inviteCode).toBeDefined();

    householdId = res.body.household.id;
    inviteCode = res.body.household.inviteCode;
  });

  it('POST /households/join should allow a second user to join via invite code', async () => {
    // Signup second user
    const signupRes = await request(app).post('/auth/signup').send({
      email: 'roommate@simmers.app',
      password: 'Password123!',
      displayName: 'Roommate',
    });
    secondUserToken = signupRes.body.token;

    // Join household
    const joinRes = await request(app)
      .post('/households/join')
      .set('Authorization', `Bearer ${secondUserToken}`)
      .send({ inviteCode });

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.household.id).toBe(householdId);
  });

  it('GET /households/:id should reject non-members with 403 Forbidden', async () => {
    // Signup third user who is not a member
    const thirdUserRes = await request(app).post('/auth/signup').send({
      email: 'stranger@simmers.app',
      password: 'Password123!',
      displayName: 'Stranger',
    });

    const res = await request(app)
      .get(`/households/${householdId}`)
      .set('Authorization', `Bearer ${thirdUserRes.body.token}`);

    expect(res.status).toBe(403);
  });

  it('POST /households/:id/items should add a new pantry item', async () => {
    const res = await request(app)
      .post(`/households/${householdId}/items`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Fresh Milk',
        quantity: 2,
        unit: 'liters',
        expiryDate: '2026-08-30',
      });

    expect(res.status).toBe(201);
    expect(res.body.item.name).toBe('Fresh Milk');
    itemId = res.body.item.id;
  });

  it('GET /households/:id/items should list items for household member', async () => {
    const res = await request(app)
      .get(`/households/${householdId}/items`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('PATCH /households/:id/items/:itemId should update item details', async () => {
    const res = await request(app)
      .patch(`/households/${householdId}/items/${itemId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ quantity: 1 });

    expect(res.status).toBe(200);
    expect(res.body.item.quantity).toBe(1);
  });

  it('POST /households/:id/items/scan should return structured OCR results', async () => {
    const res = await request(app)
      .post(`/households/${householdId}/items/scan`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ image: 'data:image/jpeg;base64,mockBase64String' });

    expect(res.status).toBe(200);
    expect(res.body.result.confidence).toBeDefined();
  });

  it('DELETE /households/:id/items/:itemId should remove pantry item', async () => {
    const res = await request(app)
      .delete(`/households/${householdId}/items/${itemId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.deletedItemId).toBe(itemId);
  });
});
