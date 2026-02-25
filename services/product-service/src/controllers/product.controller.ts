import { Request, Response } from 'express';
import { createProductSchema, updateProductSchema } from '../schemas/product.schema';
import { paginationSchema, idParamSchema } from '@microservices/shared';
import * as productService from '../services/product.service';

export async function create(req: Request, res: Response) {
  try {
    const data = createProductSchema.parse(req.body);
    const product = await productService.createProduct(data);
    res.status(201).json({ success: true, data: product });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: err.message } });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const product = await productService.getProductById(id);
    res.json({ success: true, data: product });
  } catch (err: any) {
    if (err.message === 'Product not found') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: err.message } });
    }
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: err.message } });
  }
}

export async function list(req: Request, res: Response) {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const search = req.query.search as string | undefined;
    const result = await productService.listProducts(page, limit, search);
    res.json({
      success: true,
      data: result.products,
      meta: { page: result.page, limit: result.limit, total: result.total },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateProductSchema.parse(req.body);
    const version = parseInt(req.headers['x-expected-version'] as string) || 1;
    const product = await productService.updateProduct(id, data, version);
    res.json({ success: true, data: product });
  } catch (err: any) {
    if (err.message === 'Product not found') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: err.message } });
    }
    if (err.message.includes('Version conflict')) {
      return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: err.message } });
    }
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: err.message } });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const { id } = idParamSchema.parse(req.params);
    await productService.deleteProduct(id);
    res.json({ success: true, data: { message: 'Product deleted' } });
  } catch (err: any) {
    if (err.message === 'Product not found') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: err.message } });
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
}
