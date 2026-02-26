import { Router } from 'express';
import { validate, paginationSchema, idParamSchema } from '@microservices/shared';
import { createProductSchema, updateProductSchema } from '../schemas/product.schema';
import * as productController from '../controllers/product.controller';

const router = Router();

router.get('/products', validate(paginationSchema, { source: 'query' }), productController.list);
router.get('/products/:id', validate(idParamSchema, { source: 'params' }), productController.getById);
router.post('/products', validate(createProductSchema), productController.create);
router.put(
  '/products/:id',
  validate(idParamSchema, { source: 'params' }),
  validate(updateProductSchema),
  productController.update,
);
router.delete('/products/:id', validate(idParamSchema, { source: 'params' }), productController.remove);

export { router as productRoutes };
