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
      PredictedRankRequest: {
        type: 'object',
        required: ['rank', 'horseId'],
        properties: {
          rank: { type: 'integer', minimum: 1, example: 1 },
          horseId: { type: 'string', example: '665f1e000000000000000001' },
        },
      },
      CreatePredictionRequest: {
        type: 'object',
        required: ['raceId', 'predictedRanks'],
        properties: {
          raceId: { type: 'string', example: '665f1e000000000000000010' },
          predictedRanks: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            description: 'Top-rank predictions. MVP scoring focuses on top 3.',
            items: { $ref: '#/components/schemas/PredictedRankRequest' },
          },
        },
      },
      PredictionDto: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          raceId: { type: 'string' },
          raceName: { type: 'string' },
          tournamentName: { type: 'string' },
          status: {
            type: 'string',
            enum: ['pending', 'partial', 'correct', 'incorrect'],
          },
          contribution: {
            type: 'number',
            example: 50000,
            description: 'Prediction ticket points paid into the bounty pool.',
          },
          predictionScore: {
            type: 'number',
            example: 65,
            description: 'Bounty scoring weight: exact rank 1/2/3 = 50/40/30, wrong-position top 3 = 15.',
          },
          pointsEarned: { type: 'number', example: 100 },
          bonusPoints: { type: 'number', example: 50 },
          poolShare: {
            type: 'number',
            example: 225000,
            description: 'Reward points received from SpectatorRewardPool.',
          },
          totalPoints: { type: 'number', example: 225150 },
          evaluatedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          predictedRanks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                rank: { type: 'integer', example: 1 },
                horseId: { type: 'string' },
                horseName: { type: 'string' },
              },
            },
          },
        },
      },
      BountyPoolFormula: {
        type: 'object',
        description: 'Prediction bounty pool settlement formula used when admin publishes race results.',
        properties: {
          totalBountyPool: {
            type: 'string',
            example: 'ticketPrice * numberOfParticipants',
          },
          organizerFee: {
            type: 'string',
            example: 'totalBountyPool * 10%',
          },
          racingRewardPool: {
            type: 'string',
            example: 'totalBountyPool * 15%',
          },
          spectatorRewardPool: {
            type: 'string',
            example: 'totalBountyPool * 75%',
          },
          ownerReward: {
            type: 'string',
            example: 'racingRewardPool * 80%',
          },
          jockeyReward: {
            type: 'string',
            example: 'racingRewardPool * 20%',
          },
          userReward: {
            type: 'string',
            example: 'userPredictionScore / totalWinnerScore * spectatorRewardPool',
          },
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
        summary: 'Publish a race result and settle prediction bounty pool',
        description:
          'Publishes confirmed race results, scores pending predictions, charges the bounty formula, records organizer fee, notifies owner/jockey, and distributes spectator pool shares.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Result published and bounty pool settlement attempted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                  },
                },
              },
            },
          },
          409: { description: 'Result is not confirmed yet or was already published' },
        },
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
        summary: 'List my predictions',
        description:
          'Returns prediction history including bounty fields: contribution, predictionScore, poolShare, and totalPoints.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Compatibility path parameter. Current backend returns the authenticated spectator prediction list.',
          },
        ],
        responses: {
          200: {
            description: 'Prediction list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    predictions: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/PredictionDto' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Spectator'],
        summary: 'Create a race prediction and buy a bounty ticket when enabled',
        description:
          'Creates one prediction for the race. If tournament predictionConfig.poolEnabled is true, the backend spends entryFee points from the spectator profile, records contribution, and adds it to the flexible bounty pool.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Race id. The request body also accepts raceId for current controller compatibility.',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreatePredictionRequest' },
              examples: {
                top3Prediction: {
                  value: {
                    raceId: '665f1e000000000000000010',
                    predictedRanks: [
                      { rank: 1, horseId: '665f1e000000000000000001' },
                      { rank: 2, horseId: '665f1e000000000000000002' },
                      { rank: 3, horseId: '665f1e000000000000000003' },
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created prediction',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    prediction: { $ref: '#/components/schemas/PredictionDto' },
                  },
                },
              },
            },
          },
          409: {
            description: 'Prediction window closed, duplicate prediction, pool closed, or insufficient points',
          },
        },
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
