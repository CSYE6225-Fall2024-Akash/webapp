const request = require('supertest');
const { app, startServer } = require('../app'); 
const User = require('../models/User');
const sequelize = require('../models/index');

jest.setTimeout(30000);

beforeAll(async () => {
  await sequelize.sync();
}, 10000);

afterAll(async () => {
  await User.destroy({ where: {} });
  await sequelize.close();
}, 10000);

describe('User Routes', () => {
  let createdUser;

  describe('POST /v1/user', () => {
    it('should create a new unverified user', async () => {
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
      
      // Store user for later tests
      createdUser = await User.findOne({ where: { email: 'john@example.com' } });
      expect(createdUser.isVerified).toBe(false);
    }, 10000);
  });

  describe('GET /v1/verify', () => {
    it('should verify user with valid token', async () => {
      const response = await request(app)
        .get(`/v1/verify?email=${createdUser.email}&token=${createdUser.verificationToken}`);

      expect(response.statusCode).toBe(200);

      // Check if user is verified
      const verifiedUser = await User.findOne({ where: { email: createdUser.email } });
      expect(verifiedUser.isVerified).toBe(true);
    }, 10000);
  });

  describe('GET /v1/user/self', () => {
    it('should block access when user is not verified', async () => {
      // Create new unverified user
      const unverifiedUser = await User.create({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        password_hash: 'password123',
        isVerified: false
      });

      const response = await request(app)
        .get('/v1/user/self')
        .auth(unverifiedUser.email, 'password123');

      expect(response.statusCode).toBe(403);
    }, 10000);
  });
});