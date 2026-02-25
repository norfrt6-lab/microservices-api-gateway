import { Router } from 'express';
import * as userController from '../controllers/user.controller';

const router = Router();

// Auth routes
router.post('/auth/register', userController.register);
router.post('/auth/login', userController.login);

// User routes (auth enforced at gateway level)
router.get('/users/profile', userController.getProfile);
router.get('/users', userController.listUsers);

export { router as userRoutes };
