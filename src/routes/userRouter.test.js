const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let testUserId;

beforeAll(async () => {
  //could create a new database here and destroy the database in an end all
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test('user can update their own account', async () => {
  const loginRes = await request(app)
    .put('/api/auth')
    .send({
      email: testUser.email,
      password: 'a',
    });

    const getRes = await request(app)
        .get('/api/user/me')
        .set('Authorization', `Bearer ${testUserAuthToken}`);
    
    expect(getRes.status).toBe(200);

    testUserId = getRes.body.id
  expect(loginRes.status).toBe(200);
  const token = loginRes.body.token;

  const newName = 'Updated Name';

  const res = await request(app)
    .put(`/api/user/${testUserId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: newName,
      email: testUser.email,
      password: 'a',
    });

  expect(res.status).toBe(200);

  expect(res.body).toEqual(
    expect.objectContaining({
      user: expect.objectContaining({
        id: testUserId,
        name: newName,
        email: testUser.email,
      })
    })
  );
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}