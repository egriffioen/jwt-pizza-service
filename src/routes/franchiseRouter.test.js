const request = require('supertest');
const app = require('../service');

let franchiseName;

beforeAll(async () => {
    const admin = await createAdminUser()
    
    const loginRes = await request(app).put('/api/auth').send({
    email: admin.email,
    password: admin.password,});
    expect(loginRes.status).toBe(200);
    expectValidJwt(loginRes.body.token);
    franchiseName = randomName();
    const franchise = {
        name: franchiseName,
        admins: [{ email: admin.email }],
    };
    
    const createRes = (await request(app).post('/api/franchise')
    .set('Authorization', `Bearer ${loginRes.body.token}`)
    .send(franchise));
    expect(createRes.status).toBe(200);
});

test('list all franchises', async() => {
    const res = await request(app)
    .get('/api/franchise')
    .query({ page: 0, limit: 10 });

  expect(res.status).toBe(200);

  expect(res.body).toEqual(
    expect.objectContaining({
      franchises: expect.any(Array),
      more: expect.any(Boolean),
    })
  );

  // verify our franchise exists
  expect(
    res.body.franchises.some((f) => f.name === franchiseName)
  ).toBe(true);
})


function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

const { Role, DB } = require('../database/database.js');

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5); // 5 minutes
}