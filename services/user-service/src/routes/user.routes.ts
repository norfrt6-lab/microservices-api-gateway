import { Router } from 'express';
import { validate, paginationSchema } from '@microservices/shared';
import { registerSchema, loginSchema } from '../schemas/user.schema';
import * as userController from '../controllers/user.controller';

const router = Router();

// Auth routes
router.post('/auth/register', validate(registerSchema), userController.register);
router.post('/auth/login', validate(loginSchema), userController.login);

// User routes (auth enforced at gateway level)
router.get('/users/profile', userController.getProfile);
router.get('/users', validate(paginationSchema, { source: 'query' }), userController.listUsers);

export { router as userRoutes };
