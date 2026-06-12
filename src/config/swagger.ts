import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Horse Racing API',
    version: '1.0.0',
    description: 'REST API documentation for the Horse Racing tournament management system.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'fullName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          fullName: { type: 'string' },
        },
      },
      AuthUser: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: {
            type: 'string',
            enum: ['admin', 'spectator', 'jockey', 'referee', 'horse_owner'],
          },
          fullName: { type: 'string' },
        },
      },
    },
  },
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Admin' },
    { name: 'Admin Jobs' },
    { name: 'Tournaments' },
    { name: 'Races' },
    { name: 'Horse Owner' },
    { name: 'Jockey' },
    { name: 'Referee' },
    { name: 'Spectator' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Check API health',
        responses: {
          200: { description: 'API is running' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and receive a JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          200: { description: 'Authenticated user and token' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a spectator account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          201: { description: 'Registered user and token' },
          400: { description: 'Invalid registration data' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Current user' },
          401: { description: 'Missing or invalid token' },
        },
      },
    },
    '/api/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List user accounts',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'User list' } },
      },
    },
    '/api/admin/registrations': {
      get: {
        tags: ['Admin'],
        summary: 'List race registrations pending review',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Registration list' } },
      },
    },
    '/api/admin/registrations/{id}': {
      patch: {
        tags: ['Admin'],
        summary: 'Approve or reject a registration',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Updated registration' } },
      },
    },
    '/api/admin/races/{id}/result/publish': {
      patch: {
        tags: ['Admin'],
        summary: 'Publish a race result',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Published result' } },
      },
    },
    '/api/admin/results/publish-queue': {
      get: {
        tags: ['Admin'],
        summary: 'List results waiting to be published',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Publish queue' } },
      },
    },
    '/api/admin/jobs/viewing-ticket-reminders': {
      post: {
        tags: ['Admin Jobs'],
        summary: 'Run viewing ticket reminder job',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Reminder job result' } },
      },
    },
    '/api/tournaments': {
      get: {
        tags: ['Tournaments'],
        summary: 'List tournaments',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Tournament list' } },
      },
      post: {
        tags: ['Tournaments'],
        summary: 'Create a tournament',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Created tournament' } },
      },
    },
    '/api/tournaments/{id}': {
      get: {
        tags: ['Tournaments'],
        summary: 'Get tournament details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Tournament details' } },
      },
    },
    '/api/tournaments/{id}/status': {
      patch: {
        tags: ['Tournaments'],
        summary: 'Update tournament status',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Updated tournament' } },
      },
    },
    '/api/races': {
      post: {
        tags: ['Races'],
        summary: 'Create a race',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Created race' } },
      },
    },
    '/api/races/tournament/{tournamentId}': {
      get: {
        tags: ['Races'],
        summary: 'List races by tournament',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'tournamentId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Race list' } },
      },
    },
    '/api/races/{id}': {
      get: {
        tags: ['Races'],
        summary: 'Get race details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Race details' } },
      },
    },
    '/api/races/{id}/participants': {
      post: {
        tags: ['Races'],
        summary: 'Add a race participant',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 201: { description: 'Added participant' } },
      },
    },
    '/api/races/{id}/status': {
      patch: {
        tags: ['Races'],
        summary: 'Update race status',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Updated race' } },
      },
    },
    '/api/horse-owner/horses': {
      get: {
        tags: ['Horse Owner'],
        summary: 'List my horses',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Horse list' } },
      },
      post: {
        tags: ['Horse Owner'],
        summary: 'Create a horse',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Created horse' } },
      },
    },
    '/api/horse-owner/horses/{id}': {
      patch: {
        tags: ['Horse Owner'],
        summary: 'Update horse information',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Updated horse' } },
      },
    },
    '/api/horse-owner/registrations': {
      get: {
        tags: ['Horse Owner'],
        summary: 'List my registrations',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Registration list' } },
      },
      post: {
        tags: ['Horse Owner'],
        summary: 'Register for a race',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Created registration' } },
      },
    },
    '/api/horse-owner/registrations/{id}': {
      delete: {
        tags: ['Horse Owner'],
        summary: 'Cancel a race registration',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Cancelled registration' } },
      },
    },
    '/api/horse-owner/invitations': {
      post: {
        tags: ['Horse Owner'],
        summary: 'Invite a jockey',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Created invitation' } },
      },
    },
    '/api/jockey/dashboard': {
      get: {
        tags: ['Jockey'],
        summary: 'Get jockey dashboard',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Dashboard data' } },
      },
    },
    '/api/jockey/invitations': {
      get: {
        tags: ['Jockey'],
        summary: 'List jockey invitations',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Invitation list' } },
      },
    },
    '/api/jockey/invitations/{id}': {
      patch: {
        tags: ['Jockey'],
        summary: 'Accept or decline a jockey invitation',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Updated invitation' } },
      },
    },
    '/api/jockey/races': {
      get: {
        tags: ['Jockey'],
        summary: 'List races assigned to the jockey',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Race list' } },
      },
    },
    '/api/jockey/races/{id}': {
      get: {
        tags: ['Jockey'],
        summary: 'Get assigned race details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Race details' } },
      },
    },
    '/api/jockey/notifications': {
      get: {
        tags: ['Jockey'],
        summary: 'List jockey notifications',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Notification list' } },
      },
    },
    '/api/referee/dashboard': {
      get: {
        tags: ['Referee'],
        summary: 'Get referee dashboard',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Dashboard data' } },
      },
    },
    '/api/referee/races': {
      get: {
        tags: ['Referee'],
        summary: 'List referee races',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Race list' } },
      },
    },
    '/api/referee/races/{id}/checks': {
      get: {
        tags: ['Referee'],
        summary: 'List pre-race checks',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Check list' } },
      },
      patch: {
        tags: ['Referee'],
        summary: 'Toggle a pre-race check',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Updated check' } },
      },
    },
    '/api/referee/races/{id}/result': {
      get: {
        tags: ['Referee'],
        summary: 'Get race result draft',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Race result' } },
      },
      post: {
        tags: ['Referee'],
        summary: 'Create or update race result',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Updated result' } },
      },
    },
    '/api/referee/races/{id}/result/confirm': {
      patch: {
        tags: ['Referee'],
        summary: 'Confirm race result',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Confirmed result' } },
      },
    },
    '/api/spectator/tournaments': {
      get: {
        tags: ['Spectator'],
        summary: 'List spectator-visible tournaments',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Tournament list' } },
      },
    },
    '/api/spectator/races': {
      get: {
        tags: ['Spectator'],
        summary: 'List spectator-visible races',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Race list' } },
      },
    },
    '/api/spectator/races/{id}': {
      get: {
        tags: ['Spectator'],
        summary: 'Get spectator race details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Race details' } },
      },
    },
    '/api/spectator/races/{id}/viewing-pass': {
      post: {
        tags: ['Spectator'],
        summary: 'Purchase a race viewing pass',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 201: { description: 'Created viewing pass' } },
      },
    },
    '/api/spectator/viewing-passes': {
      get: {
        tags: ['Spectator'],
        summary: 'List my viewing passes',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Viewing pass list' } },
      },
    },
    '/api/spectator/predictions/{id}': {
      get: {
        tags: ['Spectator'],
        summary: 'List predictions for a race',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Prediction list' } },
      },
      post: {
        tags: ['Spectator'],
        summary: 'Create a race prediction',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 201: { description: 'Created prediction' } },
      },
    },
    '/api/spectator/points': {
      get: {
        tags: ['Spectator'],
        summary: 'Get spectator points balance and history',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Points data' } },
      },
    },
    '/api/spectator/products': {
      get: {
        tags: ['Spectator'],
        summary: 'List reward products',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Product list' } },
      },
    },
    '/api/spectator/redemptions': {
      post: {
        tags: ['Spectator'],
        summary: 'Redeem points for a product',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Created redemption' } },
      },
    },
    '/api/spectator/notifications': {
      get: {
        tags: ['Spectator'],
        summary: 'List spectator notifications',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Notification list' } },
      },
    },
  },
};

export const swaggerSpec = swaggerJSDoc({
  definition: swaggerDefinition,
  apis: [],
});

export function setupSwagger(app: Express): void {
  app.get('/api/docs.json', (_req, res) => {
    res.json(swaggerSpec);
  });

  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Horse Racing API Docs',
    }),
  );
}
