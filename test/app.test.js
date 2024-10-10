const request = require('supertest');
const { app, startServer } = require('../app'); // Ensure your app has a startServer method
const User = require('../models/User');
const sequelize = require('../models/index');


beforeAll(async () => {
  await User.destroy({ where: {} });
  await sequelize.sync();
});

afterAll(async () => {
  await sequelize.close(); 
});

describe('Health Check', () => {
  it('should return 200 when database is connected', async () => {
    const response = await request(app).get('/healthz');
    expect(response.statusCode).toBe(200);
  });

  it('should return 405 for non-GET requests', async () => {
    const response = await request(app).post('/healthz');
    expect(response.statusCode).toBe(405);
  });

  it('should return 400 if query parameters are present', async () => {
    const response = await request(app).get('/healthz?param=value');
    expect(response.statusCode).toBe(400);
  });

  it('should return 400 if body is present', async () => {
    const response = await request(app).get('/healthz').send({ key: 'value' });
    expect(response.statusCode).toBe(400);
  });

  it('should return 404 for invalid sub-paths', async () => {
    const response = await request(app).get('/healthz/invalid');
    expect(response.statusCode).toBe(404);
  });
});

describe('User Routes', () => {
  describe('POST /v1/user', () => {
    it('should create a new user', async () => {
      const response = await request(app)
        .post('/v1/user')
        .send({
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          password: 'password123'
        });

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.first_name).toBe('John');
      expect(response.body.last_name).toBe('Doe');
      expect(response.body.email).toBe('john@example.com');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 400 if email already exists', async () => {
      const response = await request(app)
        .post('/v1/user')
        .send({
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'john@example.com',
          password: 'password456'
        });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /v1/user/self', () => {
    it('should return user information for authenticated user', async () => {
      const user = await User.findOne({ where: { email: 'john@example.com' } });
      const response = await request(app)
        .get('/v1/user/self')
        .auth(user.email, 'password123');

      expect(response.statusCode).toBe(200);
      expect(response.body.email).toBe('john@example.com');
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app).get('/v1/user/self');
      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /v1/user/self', () => {
    it('should update user information', async () => {
      const user = await User.findOne({ where: { email: 'john@example.com' } });
      const response = await request(app)
        .put('/v1/user/self')
        .auth(user.email, 'password123')
        .send({
          first_name: 'Johnny',
          last_name: 'Doey'
        });

      expect(response.statusCode).toBe(204);

      const updatedUser = await User.findOne({ where: { email: 'john@example.com' } });
      expect(updatedUser.first_name).toBe('Johnny');
      expect(updatedUser.last_name).toBe('Doey');
    });

    it('should return 400 if trying to update email', async () => {
      const user = await User.findOne({ where: { email: 'john@example.com' } });
      const response = await request(app)
        .put('/v1/user/self')
        .auth(user.email, 'password123')
        .send({
          email: 'newemail@example.com'
        });

      expect(response.statusCode).toBe(400);
    });
  });
});


