import { Request, Response, NextFunction } from 'express';
import { createProductSchema, updateProductSchema } from '../schemas/product.schema';
import { paginationSchema, idParamSchema, NotFoundError, ConflictError } from '@microservices/shared';
import * as productService from '../services/product.service';

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createProductSchema.parse(req.body);
    const product = await productService.createProduct(data);
    return res.status(201).json({ success: true, data: product });
  } catch (err: unknown) {
    return next(err as Error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const product = await productService.getProductById(id);
    return res.json({ success: true, data: product });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Product not found') {
      return next(new NotFoundError('Product not found'));
    }
    return next(err as Error);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const search = req.query.search as string | undefined;
    const result = await productService.listProducts(page, limit, search);
    return res.json({
      success: true,
      data: result.products,
      meta: { page: result.page, limit: result.limit, total: result.total },
    });
  } catch (err: unknown) {
    return next(err as Error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateProductSchema.parse(req.body);
    const version = parseInt(req.headers['x-expected-version'] as string) || 1;
    const product = await productService.updateProduct(id, data, version);
    return res.json({ success: true, data: product });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Product not found') {
      return next(new NotFoundError('Product not found'));
    }
    if (err instanceof Error && err.message.includes('Version conflict')) {
      return next(new ConflictError(err.message));
    }
    return next(err as Error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idParamSchema.parse(req.params);
    await productService.deleteProduct(id);
    return res.json({ success: true, data: { message: 'Product deleted' } });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Product not found') {
      return next(new NotFoundError('Product not found'));
    }
    return next(err as Error);
  }
}
