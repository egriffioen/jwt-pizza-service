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

test('list users unauthorized', async () => {
  const listUsersRes = await request(app).get('/api/user');
  expect(listUsersRes.status).toBe(401);
});

test('list users as non-admin', async () => {
  const [user, userToken] = await registerUser(request(app));
  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + userToken);
  expect(listUsersRes.status).toBe(403);
});

test('list users as admin', async () => {
  admin = await createAdminUser()
    
  loginRes = await request(app).put('/api/auth').send({
  email: admin.email,
  password: admin.password,});
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);
  const listUsersRes = await request(app)
    .get('/api/user?limit=5')
    .set('Authorization', 'Bearer ' + loginRes.body.token);
  expect(listUsersRes.status).toBe(200);
  expect(listUsersRes.body).toHaveProperty('users');
  expect(listUsersRes.body).toHaveProperty('more');
  expect(Array.isArray(listUsersRes.body.users)).toBe(true);
  for (const u of listUsersRes.body.users) {
    expect(u).toHaveProperty('id');
    expect(u).toHaveProperty('name');
    expect(u).toHaveProperty('email');
    expect(u).toHaveProperty('roles');
    expect(u).not.toHaveProperty('password');
    console.log(u.email, u.name, u.id, u.roles)
  }
  expect(listUsersRes.body.users.length).toBeLessThanOrEqual(5);
  expect(listUsersRes.body.more).toBe(true);
  expect(admin.name).toBe(listUsersRes.body.users[0].name);
  expect(admin.email).toBe(listUsersRes.body.users[0].email);
  expect(admin.id).toBe(listUsersRes.body.users[0].id);
  expect(admin.roles.role).toBe(listUsersRes.body.users[0].roles.role)
});

test('list users pagination', async () => {
  admin = await createAdminUser()
    
  loginRes = await request(app).put('/api/auth').send({
  email: admin.email,
  password: admin.password,});
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);
  const page1 = await request(app)
    .get('/api/user?page=0&limit=5')
    .set('Authorization', 'Bearer ' + loginRes.body.token);

  const page2 = await request(app)
    .get('/api/user?page=1&limit=5')
    .set('Authorization', 'Bearer ' + loginRes.body.token);

  expect(page1.body.users[0].id)
    .not.toBe(page2.body.users[0].id);
});

test('admin can filter users by name', async () => {
  const admin = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send({
    email: admin.email,
    password: admin.password,
  });

  const token = loginRes.body.token;
  let name = randomName();
  let email = `${randomName()}@test.com`

  await registerUser(request(app));
  const specialUser = {
    name: name,
    email: email,
    password: 'a',
  };

  await request(app).post('/api/auth').send(specialUser);

  const res = await request(app)
    .get(`/api/user?name=${name}`)
    .set('Authorization', 'Bearer ' + token);

  expect(res.status).toBe(200);
  expect(res.body.users.length).toBe(1);
  expect(res.body.users[0].name).toBe(name);
});

test('delete user without auth', async () => {
  const res = await request(app).delete('/api/user/1');
  expect(res.status).toBe(401);
});

test('delete user not an admin', async () => {
  const [user, userToken] = await registerUser(request(app));
  const delRes = await request(app)
    .delete('/api/user/1')
    .set('Authorization', 'Bearer ' + userToken);
  expect(delRes.status).toBe(403);
});

test('delete user as an admin', async () => {
  const admin = await createAdminUser();

  const loginRes = await request(app).put('/api/auth').send({
    email: admin.email,
    password: admin.password,
  });

  const page1 = await request(app)
    .get('/api/user?page=0&limit=5')
    .set('Authorization', 'Bearer ' + loginRes.body.token);

  const userToDelete = page1.body.users.find(u => u.id !== admin.id);
  const userId = userToDelete.id;

  const delRes = await request(app)
    .delete(`/api/user/${userId}`)
    .set('Authorization', 'Bearer ' + loginRes.body.token);

  expect(delRes.status).toBe(200);

  const page2 = await request(app)
    .get('/api/user?page=0&limit=5')
    .set('Authorization', 'Bearer ' + loginRes.body.token);

  expect(page2.body.users.some(u => u.id === userId)).toBe(false);
});

async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth').send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}

const { Role, DB } = require('../database/database.js');

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}