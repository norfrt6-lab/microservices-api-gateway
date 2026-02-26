import { Request, Response } from 'express';
import { registerSchema, loginSchema } from '../schemas/user.schema';
import { paginationSchema } from '@microservices/shared';
import * as userService from '../services/user.service';

const getErrorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Unknown error';

export async function register(req: Request, res: Response) {
  try {
    const data = registerSchema.parse(req.body);
    const user = await userService.createUser(data);
    res.status(201).json({ success: true, data: user });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    if (message === 'Email already registered') {
      return res.status(409).json({ success: false, error: { code: 'CONFLICT', message } });
    }
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const data = loginSchema.parse(req.body);
    const result = await userService.loginUser(data);
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    if (message === 'Invalid credentials') {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message } });
    }
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}

export async function getProfile(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User ID not found' } });
    }
    const user = await userService.getUserById(userId);
    res.json({ success: true, data: user });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    if (message === 'User not found') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message } });
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
}

export async function listUsers(req: Request, res: Response) {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await userService.listUsers(page, limit);
    res.json({
      success: true,
      data: result.users,
      meta: { page: result.page, limit: result.limit, total: result.total },
    });
  } catch {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
}
