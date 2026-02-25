import { describe, it, expect, vi, beforeEach } from 'vitest';
import { register, login, getProfile, listUsers } from '../controllers/user.controller';

// Mock the user service module
vi.mock('../services/user.service', () => ({
  createUser: vi.fn(),
  loginUser: vi.fn(),
  getUserById: vi.fn(),
  listUsers: vi.fn(),
}));

import * as userService from '../services/user.service';

function createMockRes() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

describe('user controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should return 201 on successful registration', async () => {
      const mockUser = { id: '1', email: 'test@test.com', name: 'Test', role: 'USER', createdAt: new Date() };
      vi.mocked(userService.createUser).mockResolvedValue(mockUser);

      const req: any = { body: { email: 'test@test.com', password: 'password123', name: 'Test' } };
      const res = createMockRes();

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUser });
    });

    it('should return 409 on duplicate email', async () => {
      vi.mocked(userService.createUser).mockRejectedValue(new Error('Email already registered'));

      const req: any = { body: { email: 'test@test.com', password: 'password123', name: 'Test' } };
      const res = createMockRes();

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'CONFLICT' }),
      }));
    });

    it('should return 400 on validation error', async () => {
      const req: any = { body: { email: 'invalid', password: '123', name: '' } };
      const res = createMockRes();

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('login', () => {
    it('should return token on successful login', async () => {
      const mockResult = { token: 'jwt-token', user: { id: '1', email: 'test@test.com', name: 'Test', role: 'USER' } };
      vi.mocked(userService.loginUser).mockResolvedValue(mockResult);

      const req: any = { body: { email: 'test@test.com', password: 'password123' } };
      const res = createMockRes();

      await login(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it('should return 401 on invalid credentials', async () => {
      vi.mocked(userService.loginUser).mockRejectedValue(new Error('Invalid credentials'));

      const req: any = { body: { email: 'test@test.com', password: 'wrongpass' } };
      const res = createMockRes();

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      }));
    });
  });

  describe('getProfile', () => {
    it('should return user profile when x-user-id header present', async () => {
      const mockUser = { id: 'user-1', email: 'test@test.com', name: 'Test', role: 'USER', createdAt: new Date() };
      vi.mocked(userService.getUserById).mockResolvedValue(mockUser);

      const req: any = { headers: { 'x-user-id': 'user-1' } };
      const res = createMockRes();

      await getProfile(req, res);

      expect(userService.getUserById).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUser });
    });

    it('should return 401 when x-user-id header missing', async () => {
      const req: any = { headers: {} };
      const res = createMockRes();

      await getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 when user not found', async () => {
      vi.mocked(userService.getUserById).mockRejectedValue(new Error('User not found'));

      const req: any = { headers: { 'x-user-id': 'nonexistent' } };
      const res = createMockRes();

      await getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('listUsers', () => {
    it('should return paginated users', async () => {
      const mockResult = {
        users: [{ id: '1', email: 'a@a.com', name: 'A', role: 'USER', createdAt: new Date() }],
        total: 1,
        page: 1,
        limit: 20,
      };
      vi.mocked(userService.listUsers).mockResolvedValue(mockResult);

      const req: any = { query: {} };
      const res = createMockRes();

      await listUsers(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.users,
        meta: { page: 1, limit: 20, total: 1 },
      });
    });
  });
});
