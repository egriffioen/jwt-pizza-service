const request = require('supertest');
const app = require('../service');

test('get pizza menu', async () => {
  const res = await request(app)
    .get('/api/order/menu');

  expect(res.status).toBe(200);

  expect(Array.isArray(res.body)).toBe(true);

  // Each menu item should have the expected shape
  if (res.body.length > 0) {
    expect(res.body[0]).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        title: expect.any(String),
        price: expect.any(Number),
        description: expect.any(String),
        image: expect.any(String),
      })
    );
  }
});
