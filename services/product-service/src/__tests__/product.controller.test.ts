import { describe, it, expect, vi, beforeEach } from 'vitest';
import { create, getById, list, update, remove } from '../controllers/product.controller';
import type { Request, Response } from 'express';

vi.mock('../services/product.service', () => ({
  createProduct: vi.fn(),
  getProductById: vi.fn(),
  listProducts: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));

import * as productService from '../services/product.service';

function createMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Pick<Response, 'status' | 'json'>;
  return res;
}

function createMockNext() {
  return vi.fn();
}

describe('product controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should return 201 on successful creation', async () => {
      const mockProduct = { id: 'p1', name: 'Widget', price: 29.99, stock: 10 };
      vi.mocked(productService.createProduct).mockResolvedValue(
        mockProduct as Awaited<ReturnType<typeof productService.createProduct>>,
      );

      const req = { body: { name: 'Widget', price: 29.99, stock: 10 } } as unknown as Request;
      const res = createMockRes();
      const next = createMockNext();

      await create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockProduct });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 on invalid body', async () => {
      const req = { body: { name: '', price: -1, stock: -5 } } as unknown as Request;
      const res = createMockRes();
      const next = createMockNext();

      await create(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getById', () => {
    it('should return product by ID', async () => {
      const mockProduct = { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Widget' };
      vi.mocked(productService.getProductById).mockResolvedValue(
        mockProduct as Awaited<ReturnType<typeof productService.getProductById>>,
      );

      const req = { params: { id: '550e8400-e29b-41d4-a716-446655440000' } } as unknown as Request;
      const res = createMockRes();
      const next = createMockNext();

      await getById(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockProduct });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 when product not found', async () => {
      vi.mocked(productService.getProductById).mockRejectedValue(new Error('Product not found'));

      const req = { params: { id: '550e8400-e29b-41d4-a716-446655440000' } } as unknown as Request;
      const res = createMockRes();
      const next = createMockNext();

      await getById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });

    it('should return 400 on invalid ID format', async () => {
      const req = { params: { id: 'not-a-uuid' } } as unknown as Request;
      const res = createMockRes();
      const next = createMockNext();

      await getById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('list', () => {
    it('should return paginated products', async () => {
      const mockResult = { products: [], total: 0, page: 1, limit: 20 };
      vi.mocked(productService.listProducts).mockResolvedValue(mockResult);

      const req = { query: {} } as unknown as Request;
      const res = createMockRes();
      const next = createMockNext();

      await list(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        meta: { page: 1, limit: 20, total: 0 },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass search parameter', async () => {
      const mockResult = { products: [], total: 0, page: 1, limit: 20 };
      vi.mocked(productService.listProducts).mockResolvedValue(mockResult);

      const req = { query: { search: 'widget' } } as unknown as Request;
      const res = createMockRes();
      const next = createMockNext();

      await list(req, res, next);

      expect(productService.listProducts).toHaveBeenCalledWith(1, 20, 'widget');
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should return updated product', async () => {
      const mockProduct = { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Updated', version: 2 };
      vi.mocked(productService.updateProduct).mockResolvedValue(
        mockProduct as Awaited<ReturnType<typeof productService.updateProduct>>,
      );

      const req = {
        params: { id: '550e8400-e29b-41d4-a716-446655440000' },
        body: { name: 'Updated' },
        headers: { 'x-expected-version': '1' },
      } as unknown as Request;
      const res = createMockRes();
      const next = createMockNext();

      await update(req, res, next);

      expect(productService.updateProduct).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        { name: 'Updated' },
        1,
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockProduct });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 409 on version conflict', async () => {
      vi.mocked(productService.updateProduct).mockRejectedValue(
        new Error('Version conflict — product was modified by another request'),
      );

      const req = {
        params: { id: '550e8400-e29b-41d4-a716-446655440000' },
        body: { name: 'Updated' },
        headers: { 'x-expected-version': '1' },
      } as unknown as Request;
      const res = createMockRes();
      const next = createMockNext();

      await update(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    });

    it('should return 404 when product not found', async () => {
      vi.mocked(productService.updateProduct).mockRejectedValue(new Error('Product not found'));

      const req = {
        params: { id: '550e8400-e29b-41d4-a716-446655440000' },
        body: { name: 'Updated' },
        headers: {},
      } as unknown as Request;
      const res = createMockRes();
      const next = createMockNext();

      await update(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe('remove', () => {
    it('should return success on delete', async () => {
      vi.mocked(productService.deleteProduct).mockResolvedValue(undefined);

      const req = { params: { id: '550e8400-e29b-41d4-a716-446655440000' } } as unknown as Request;
      const res = createMockRes();
      const next = createMockNext();

      await remove(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: { message: 'Product deleted' } });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 when product not found', async () => {
      vi.mocked(productService.deleteProduct).mockRejectedValue(new Error('Product not found'));

      const req = { params: { id: '550e8400-e29b-41d4-a716-446655440000' } } as unknown as Request;
      const res = createMockRes();
      const next = createMockNext();

      await remove(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });
});
