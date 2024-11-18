const request = require('supertest');
const { app, startServer } = require('../app'); 
const User = require('../models/User');
const sequelize = require('../models/index');

// Increase the default timeout for all tests
jest.setTimeout(30000);

beforeAll(async () => {
  await sequelize.sync();
}, 10000);

afterAll(async () => {
  await User.destroy({ where: {} });
  await sequelize.close();
}, 10000);

// Health Check tests remain the same
describe('Health Check', () => {
  // ... existing health check tests ...
});

describe('User Routes', () => {
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
      expect(response.body.first_name).toBe('John');
      expect(response.body.last_name).toBe('Doe');
      expect(response.body.email).toBe('john@example.com');
      expect(response.body).not.toHaveProperty('password');
      
      // Check database for verification status
      const user = await User.findOne({ where: { email: 'john@example.com' } });
      expect(user.isVerified).toBe(false);
      expect(user.verificationToken).toBeTruthy();
    }, 10000);

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
    }, 10000);
  });

  describe('GET /v1/verify', () => {
    let verificationToken;
    
    beforeAll(async () => {
      const user = await User.findOne({ where: { email: 'john@example.com' } });
      verificationToken = user.verificationToken;
    });

    it('should verify user with valid token', async () => {
      const response = await request(app)
        .get(`/v1/verify?email=john@example.com&token=${verificationToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe('Email verified successfully');

      // Check if user is verified in database
      const user = await User.findOne({ where: { email: 'john@example.com' } });
      expect(user.isVerified).toBe(true);
      expect(user.verificationToken).toBeNull();
    }, 10000);

    it('should return 400 for invalid token', async () => {
      const response = await request(app)
        .get('/v1/verify?email=john@example.com&token=invalid_token');

      expect(response.statusCode).toBe(400);
    }, 10000);

    it('should return 400 for missing parameters', async () => {
      const response = await request(app)
        .get('/v1/verify');

      expect(response.statusCode).toBe(400);
    }, 10000);
  });

  describe('Protected Routes Access', () => {
    it('should deny access to unverified user', async () => {
      // Create new unverified user
      const newUser = await User.create({
        first_name: 'Unverified',
        last_name: 'User',
        email: 'unverified@example.com',
        password_hash: 'password123',
        isVerified: false
      });

      const response = await request(app)
        .get('/v1/user/self')
        .auth(newUser.email, 'password123');

      expect(response.statusCode).toBe(403);
    }, 10000);

    it('should allow access to verified user', async () => {
      // Get the verified user from previous tests
      const user = await User.findOne({ 
        where: { 
          email: 'john@example.com',
          isVerified: true 
        } 
      });

      const response = await request(app)
        .get('/v1/user/self')
        .auth(user.email, 'password123');

      expect(response.statusCode).toBe(200);
      expect(response.body.email).toBe('john@example.com');
    }, 10000);
  });

  describe('GET /v1/user/self', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app).get('/v1/user/self');
      expect(response.statusCode).toBe(401);
    }, 10000);
  });

  describe('PUT /v1/user/self', () => {
    it('should update verified user information', async () => {
      const user = await User.findOne({ 
        where: { 
          email: 'john@example.com',
          isVerified: true 
        } 
      });
      
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
    }, 10000);

    it('should return 400 if trying to update email', async () => {
      const user = await User.findOne({ where: { email: 'john@example.com' } });
      const response = await request(app)
        .put('/v1/user/self')
        .auth(user.email, 'password123')
        .send({
          email: 'newemail@example.com'
        });

      expect(response.statusCode).toBe(400);
    }, 10000);

    it('should deny update for unverified user', async () => {
      const unverifiedUser = await User.findOne({ 
        where: { 
          email: 'unverified@example.com'
        } 
      });

      const response = await request(app)
        .put('/v1/user/self')
        .auth(unverifiedUser.email, 'password123')
        .send({
          first_name: 'Updated'
        });

      expect(response.statusCode).toBe(403);
    }, 10000);
  });
});