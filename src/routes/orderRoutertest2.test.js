const request = require('supertest');
const express = require('express');

// 🔥 Mock dependencies BEFORE requiring router
jest.mock('../database/database.js', () => ({
  Role: { Admin: 'admin' },
  DB: {
    getMenu: jest.fn(),
    addMenuItem: jest.fn(),
    getOrders: jest.fn(),
    addDinerOrder: jest.fn(),
  },
}));

jest.mock('../metrics.js', () => ({
  recordOrderSuccess: jest.fn(),
  recordOrderFailure: jest.fn(),
}));

// Mock auth middleware
const mockUser = {
  id: 1,
  name: 'test',
  email: 'test@test.com',
  isRole: jest.fn(),
};

jest.mock('./authRouter.js', () => ({
  authRouter: {
    authenticateToken: (req, res, next) => {
      req.user = mockUser;
      next();
    },
  },
}));

// Mock fetch
global.fetch = jest.fn();

const { DB, Role } = require('../database/database.js');
const metrics = require('../metrics.js');
const orderRouter = require('./orderRouter.js');

// Build test app
const app = express();
app.use(express.json());
app.use('/api/order', orderRouter);

beforeEach(() => {
  jest.clearAllMocks();
});

//
// 🧪 TESTS
//

test('GET /menu returns menu', async () => {
  DB.getMenu.mockResolvedValue([{ id: 1, title: 'Pizza' }]);

  const res = await request(app).get('/api/order/menu');

  expect(res.status).toBe(200);
  expect(DB.getMenu).toHaveBeenCalled();
  expect(res.body).toEqual([{ id: 1, title: 'Pizza' }]);
});

test('PUT /menu rejects non-admin', async () => {
  mockUser.isRole.mockReturnValue(false);

  const res = await request(app)
    .put('/api/order/menu')
    .send({ title: 'New Pizza' });

  expect(res.status).toBe(403);
});

test('PUT /menu allows admin and returns updated menu', async () => {
  mockUser.isRole.mockReturnValue(true);

  DB.getMenu.mockResolvedValue([{ id: 1 }]);

  const res = await request(app)
    .put('/api/order/menu')
    .send({ title: 'New Pizza' });

  expect(res.status).toBe(200);
  expect(DB.addMenuItem).toHaveBeenCalled();
  expect(DB.getMenu).toHaveBeenCalled();
});

test('GET / returns user orders', async () => {
  DB.getOrders.mockResolvedValue({ orders: [] });

  const res = await request(app).get('/api/order?page=2');

  expect(res.status).toBe(200);
  expect(DB.getOrders).toHaveBeenCalledWith(mockUser, '2');
  expect(res.body).toEqual({ orders: [] });
});

test('POST / creates order (factory success)', async () => {
  const fakeOrder = { id: 1, items: [{ price: 10 }] };

  DB.addDinerOrder.mockResolvedValue(fakeOrder);

  fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      reportUrl: 'http://factory/success',
      jwt: 'factory-jwt',
    }),
  });

  const res = await request(app)
    .post('/api/order')
    .send({ items: [{ menuId: 1 }] });

  expect(res.status).toBe(200);
  expect(DB.addDinerOrder).toHaveBeenCalled();
  expect(fetch).toHaveBeenCalled();

  expect(metrics.recordOrderSuccess).toHaveBeenCalledWith(fakeOrder.items);

  expect(res.body).toEqual({
    order: fakeOrder,
    followLinkToEndChaos: 'http://factory/success',
    jwt: 'factory-jwt',
  });
});

test('POST / handles factory failure', async () => {
  const fakeOrder = { id: 1, items: [] };

  DB.addDinerOrder.mockResolvedValue(fakeOrder);

  fetch.mockResolvedValue({
    ok: false,
    json: async () => ({
      reportUrl: 'http://factory/fail',
    }),
  });

  const res = await request(app)
    .post('/api/order')
    .send({ items: [] });

  expect(res.status).toBe(500);

  expect(metrics.recordOrderFailure).toHaveBeenCalled();

  expect(res.body).toEqual({
    message: 'Failed to fulfill order at factory',
    followLinkToEndChaos: 'http://factory/fail',
  });
});