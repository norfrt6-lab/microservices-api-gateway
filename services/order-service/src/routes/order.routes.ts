import { Router } from 'express';
import * as orderController from '../controllers/order.controller';

const router = Router();

router.post('/orders', orderController.create);
router.get('/orders', orderController.list);
router.get('/orders/:id', orderController.getById);
router.post('/orders/:id/confirm', orderController.confirm);
router.post('/orders/:id/cancel', orderController.cancel);

export { router as orderRoutes };
