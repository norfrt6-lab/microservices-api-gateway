import { Router, Request, Response } from 'express';

const router = Router();

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Microservices API Gateway',
    version: '1.0.0',
    description:
      'Production-grade API Gateway with circuit breaking, rate limiting, caching, saga orchestration, and distributed tracing.',
    contact: { name: 'API Support' },
    license: { name: 'MIT' },
  },
  servers: [
    { url: '/api/v1', description: 'V1 — Current stable' },
    { url: '/api/v2', description: 'V2 — Latest' },
  ],
  tags: [
    { name: 'Auth', description: 'User registration and authentication' },
    { name: 'Users', description: 'User management' },
    { name: 'Products', description: 'Product catalog' },
    { name: 'Orders', description: 'Order management with saga pattern' },
  ],
  paths: {
    '/users/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterInput' },
            },
          },
        },
        responses: {
          '201': { description: 'User created', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserResponse' } } } },
          '409': { description: 'Email already registered' },
        },
      },
    },
    '/users/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate and receive JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginInput' },
            },
          },
        },
        responses: {
          '200': { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/users/profile': {
      get: {
        tags: ['Users'],
        summary: 'Get current user profile',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'User profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserResponse' } } } },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'List users (admin)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' },
        ],
        responses: {
          '200': { description: 'Paginated user list', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } },
        },
      },
    },
    '/products': {
      get: {
        tags: ['Products'],
        summary: 'List products',
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by product name' },
        ],
        responses: {
          '200': { description: 'Paginated product list' },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Create a product',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateProductInput' },
            },
          },
        },
        responses: {
          '201': { description: 'Product created' },
          '400': { description: 'Validation error' },
        },
      },
    },
    '/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get product by ID',
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': { description: 'Product details' },
          '404': { description: 'Product not found' },
        },
      },
      put: {
        tags: ['Products'],
        summary: 'Update a product (optimistic locking)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/Id' },
          { name: 'x-expected-version', in: 'header', required: true, schema: { type: 'integer' }, description: 'Expected version for optimistic locking' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateProductInput' },
            },
          },
        },
        responses: {
          '200': { description: 'Product updated' },
          '404': { description: 'Product not found' },
          '409': { description: 'Version conflict' },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Soft-delete a product',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': { description: 'Product deleted' },
          '404': { description: 'Product not found' },
        },
      },
    },
    '/orders': {
      get: {
        tags: ['Orders'],
        summary: 'List orders for current user',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' },
        ],
        responses: {
          '200': { description: 'Paginated order list' },
          '401': { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Orders'],
        summary: 'Create order (triggers saga: stock check → reserve → payment → confirm)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'idempotency-key', in: 'header', schema: { type: 'string', format: 'uuid' }, description: 'Idempotency key to prevent duplicate orders' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateOrderInput' },
            },
          },
        },
        responses: {
          '201': { description: 'Order created' },
          '409': { description: 'Insufficient stock' },
        },
      },
    },
    '/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Get order by ID',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': { description: 'Order details' },
          '404': { description: 'Order not found' },
        },
      },
    },
    '/orders/{id}/confirm': {
      post: {
        tags: ['Orders'],
        summary: 'Confirm an order',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': { description: 'Order confirmed' },
          '404': { description: 'Order not found or cannot be confirmed' },
        },
      },
    },
    '/orders/{id}/cancel': {
      post: {
        tags: ['Orders'],
        summary: 'Cancel an order (triggers saga compensation: release stock)',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': { description: 'Order cancelled, stock released' },
          '404': { description: 'Order not found or cannot be cancelled' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    parameters: {
      Id: { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      Page: { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
      Limit: { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
    },
    schemas: {
      RegisterInput: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          name: { type: 'string', minLength: 1, maxLength: 100 },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      UserResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              email: { type: 'string' },
              name: { type: 'string' },
              role: { type: 'string', enum: ['USER', 'ADMIN'] },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              user: { $ref: '#/components/schemas/UserResponse/properties/data' },
            },
          },
        },
      },
      CreateProductInput: {
        type: 'object',
        required: ['name', 'price', 'stock'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 2000 },
          price: { type: 'number', exclusiveMinimum: 0 },
          stock: { type: 'integer', minimum: 0 },
        },
      },
      UpdateProductInput: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 2000 },
          price: { type: 'number', exclusiveMinimum: 0 },
          stock: { type: 'integer', minimum: 0 },
        },
      },
      CreateOrderInput: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: {
                productId: { type: 'string', format: 'uuid' },
                quantity: { type: 'integer', minimum: 1 },
              },
            },
          },
        },
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'array', items: {} },
          meta: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
            },
          },
        },
      },
    },
  },
};

// Serve the raw OpenAPI JSON spec
router.get('/docs/openapi.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

// Serve Swagger UI using CDN (no extra npm dependency)
router.get('/docs', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>API Gateway — Swagger UI</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({ url: '/docs/openapi.json', dom_id: '#swagger-ui', deepLinking: true });
  </script>
</body>
</html>`);
});

export { router as docsRouter };
