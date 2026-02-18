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

test('list users', async () => {
  const [user, userToken] = await registerUser(request(app));
  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + userToken);
  expect(listUsersRes.status).toBe(200);
  expect(listUsersRes.body).toHaveProperty('users');
  expect(listUsersRes.body).toHaveProperty('more');
  expect(Array.isArray(listUsersRes.body.users)).toBe(true);
  for (const user of listUsersRes.body.users) {
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('roles');
    expect(user).not.toHaveProperty('password');
    console.log(user.email, user.name, user.id, user.roles)
  }
  expect(user.name).toBe(listUsersRes.body.users[0].name);
  expect(user.email).toBe(listUsersRes.body.users[0].email);
  expect(user.id).toBe(listUsersRes.body.users[0].id);
  expect(user.roles.role).toBe(listUsersRes.body.users[0].roles.role)
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

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}