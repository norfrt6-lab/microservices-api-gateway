import { Router } from 'express';
import { createProxyRouter } from './v1/proxy';

const router = Router();

// Mount versioned proxy routers
router.use('/api/v1', createProxyRouter('v1'));

// Future: router.use('/api/v2', createProxyRouter('v2'));

export { router };
