const request = require('supertest');
const app = require('../service');

let franchiseName;
let admin;
let createRes;
let loginRes;
let franchiseId;
let token
const storeName = randomName()

beforeAll(async () => {
    admin = await createAdminUser()
    
    loginRes = await request(app).put('/api/auth').send({
    email: admin.email,
    password: admin.password,});
    expect(loginRes.status).toBe(200);
    expectValidJwt(loginRes.body.token);
    franchiseName = randomName();
    const franchise = {
        name: franchiseName,
        admins: [{ email: admin.email }],
    };
    
    createRes = (await request(app).post('/api/franchise')
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
})

test("list user's franchises", async () => {
  const userId = admin.id;

  const res = await request(app)
    .get(`/api/franchise/${userId}`)
    .set('Authorization', `Bearer ${loginRes.body.token}`);

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);

  expect(res.body.length).toBeGreaterThan(0);

  expect(
    res.body.some((f) => f.name === franchiseName)
  ).toBe(true);

  const franchise = res.body.find(f => f.name === franchiseName);

  expect(franchise).toEqual(
    expect.objectContaining({
      admins: expect.any(Array),
      stores: expect.any(Array),
    })
  );
});


test('create a store', async() => {
    franchiseId = createRes.body.id
    token = loginRes.body.token
    const storeRes = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({
        name: storeName,
        });

    expect(storeRes.status).toBe(200);

    expect(storeRes.body).toEqual(
        expect.objectContaining({
            id: expect.any(Number),
            franchiseId: franchiseId,
            name: storeName,
        })
    );
})

test('delete a store', async () => {
    franchiseId = createRes.body.id
    token = loginRes.body.token
        const storeRes = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${token}`)
        .send({
        name: storeName,
        });
    let storeId = storeRes.body.id
    const deleteRes = await request(app)
        .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
        .set('Authorization', `Bearer ${token}`);

    
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toEqual(
        expect.objectContaining({
        message: 'store deleted',
        })
    );
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