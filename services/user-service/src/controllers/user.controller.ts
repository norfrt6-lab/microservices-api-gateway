import { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from '../schemas/user.schema';
import {
  paginationSchema,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
} from '@microservices/shared';
import * as userService from '../services/user.service';



export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);
    const user = await userService.createUser(data);
    return res.status(201).json({ success: true, data: user });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Email already registered') {
      return next(new ConflictError('Email already registered'));
    }
    return next(err as Error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const data = loginSchema.parse(req.body);
    const result = await userService.loginUser(data);
    return res.json({ success: true, data: result });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Invalid credentials') {
      return next(new UnauthorizedError('Invalid credentials'));
    }
    if (err instanceof Error && err.message === 'JWT secret not configured') {
      return next(new BadRequestError('JWT secret not configured'));
    }
    return next(err as Error);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return next(new UnauthorizedError('User ID not found'));
    }
    const user = await userService.getUserById(userId);
    return res.json({ success: true, data: user });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'User not found') {
      return next(new NotFoundError('User not found'));
    }
    return next(err as Error);
  }
}

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await userService.listUsers(page, limit);
    return res.json({
      success: true,
      data: result.users,
      meta: { page: result.page, limit: result.limit, total: result.total },
    });
  } catch (err: unknown) {
    return next(err as Error);
  }
}
