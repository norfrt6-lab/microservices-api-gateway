import { Router } from 'express';
import { validate, paginationSchema, idParamSchema } from '@microservices/shared';
import { createOrderSchema } from '../schemas/order.schema';
import * as orderController from '../controllers/order.controller';

const router = Router();

router.post('/orders', validate(createOrderSchema), orderController.create);
router.get('/orders', validate(paginationSchema, { source: 'query' }), orderController.list);
router.get('/orders/:id', validate(idParamSchema, { source: 'params' }), orderController.getById);
router.post('/orders/:id/confirm', validate(idParamSchema, { source: 'params' }), orderController.confirm);
router.post('/orders/:id/cancel', validate(idParamSchema, { source: 'params' }), orderController.cancel);

export { router as orderRoutes };
