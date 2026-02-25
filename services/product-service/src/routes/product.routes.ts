import { Router } from 'express';
import * as productController from '../controllers/product.controller';

const router = Router();

router.get('/products', productController.list);
router.get('/products/:id', productController.getById);
router.post('/products', productController.create);
router.put('/products/:id', productController.update);
router.delete('/products/:id', productController.remove);

export { router as productRoutes };
