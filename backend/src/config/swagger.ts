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
            maxItems: 1,
            description: 'MVP prediction accepts one horse only: rank 1 winner prediction.',
            items: { $ref: '#/components/schemas/PredictedRankRequest' },
          },
          riskMultiplier: {
            type: 'integer',
            minimum: 1,
            example: 2,
            description:
              'Custom prediction risk multiplier. Must be a whole number within the tournament predictionConfig min/max range.',
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
            enum: ['pending', 'partial', 'correct', 'incorrect', 'cancelled'],
          },
          contribution: {
            type: 'number',
            example: 100000,
            description: 'Prediction entry points paid into the bounty pool: entryFee * riskMultiplier.',
          },
          riskMultiplier: {
            type: 'integer',
            example: 2,
            description: 'Whole-number risk multiplier used for this prediction.',
          },
          predictionScore: {
            type: 'number',
            example: 1,
            description: 'Winner-only scoring weight: 1 when rank 1 prediction is correct, otherwise 0.',
          },
          pointsEarned: {
            type: 'number',
            example: 100000,
            description: 'Returned entry points for a correct winner prediction.',
          },
          bonusPoints: { type: 'number', example: 0 },
          poolShare: {
            type: 'number',
            example: 225000,
            description: 'Prize points received from PrizePool, excluding returned entry points.',
          },
          totalPoints: {
            type: 'number',
            example: 325000,
            description: 'Total returned to the spectator: pointsEarned + poolShare.',
          },
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
            example: 'sum(entryFee * riskMultiplier) across all predictions',
          },
          winPool: {
            type: 'string',
            example: 'sum(entryFee * riskMultiplier) from incorrect winner predictions',
          },
          organizerFee: {
            type: 'string',
            example: 'winPool * 10%',
          },
          racingRewardPool: {
            type: 'string',
            example: 'winPool * 15%',
          },
          spectatorRewardPool: {
            type: 'string',
            example: 'winPool * 75%',
          },
          ownerReward: {
            type: 'string',
            example: 'racingRewardPool * 80%',
          },
          jockeyReward: {
            type: 'string',
            example: 'horseReward * 20%',
          },
          rankRewardRates: {
            type: 'string',
            example: 'RacingRewardPool is split by rank presets for 5-13 horses; same-rank dead heats split that rank share equally.',
          },
          userReward: {
            type: 'string',
            example: 'entryPoints + prizePool * (entryPoints / totalCorrectEntryPoints)',
          },
        },
      },
      PredictionConfigRequest: {
        type: 'object',
        properties: {
          isEnabled: { type: 'boolean', example: true },
          pointsPerCorrect: { type: 'number', example: 100 },
          bonusPointsTop3: { type: 'number', example: 50 },
          poolEnabled: { type: 'boolean', example: true },
          entryFee: { type: 'number', example: 50000 },
          minRiskMultiplier: { type: 'integer', minimum: 1, example: 1 },
          maxRiskMultiplier: { type: 'integer', minimum: 1, example: 10 },
          quickRiskMultipliers: {
            type: 'array',
            items: { type: 'integer', minimum: 1 },
            example: [1, 2, 3, 6],
            description:
              'Suggested quick-pick multipliers for frontend buttons. Users can still enter any whole number within min/max.',
          },
          organizerFeeRate: { type: 'number', example: 10 },
          racingRewardRate: { type: 'number', example: 15 },
          spectatorRewardRate: { type: 'number', example: 75 },
          ownerShareRate: { type: 'number', example: 80 },
          jockeyShareRate: { type: 'number', example: 20 },
          rankRewardRates: {
            type: 'array',
            items: { type: 'number' },
            example: [50, 25, 15, 7, 3],
            description: 'Must sum to 100. Used to split RacingRewardPool by result rank.',
          },
          rolloverPolicy: {
            type: 'string',
            enum: ['refund', 'rollover_next_race', 'to_organizer'],
            example: 'rollover_next_race',
          },
          minScoreToShare: { type: 'number', example: 1 },
        },
      },
      TopUpRequest: {
        type: 'object',
        required: ['points'],
        properties: {
          points: {
            type: 'integer',
            minimum: 100,
            example: 100,
            description: 'Minimum top-up is 100 points. Current mock exchange rate is 100 VND = 1 point.',
          },
        },
      },
      PaymentTransactionDto: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          provider: { type: 'string', example: 'mock' },
          amountVnd: { type: 'number', example: 10000 },
          points: { type: 'integer', example: 100 },
          exchangeRateVndPerPoint: { type: 'number', example: 100 },
          status: { type: 'string', example: 'paid' },
          providerTransactionId: { type: 'string', nullable: true },
          paidAt: { type: 'string', format: 'date-time', nullable: true },
          expiredAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      SpectatorPointsDto: {
        type: 'object',
        properties: {
          currentBalance: { type: 'number', example: 1000 },
          totalPointsEarned: { type: 'number', example: 1200 },
          totalPointsSpent: { type: 'number', example: 200 },
          transactions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: { type: 'string', example: 'topup' },
                points: { type: 'number', example: 100 },
                balanceAfter: { type: 'number', example: 1000 },
                note: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      // === NEW: THÊM SCHEMAS CHO LUẬT VÀ PHẠT ===
      CreateViolationRuleRequest: {
        type: 'object',
        required: ['code', 'description', 'category', 'severity', 'penaltyApplied'],
        properties: {
          code: { type: 'string', example: 'RC-001' },
          description: { type: 'string', example: 'Chèn ép đối thủ ở khúc cua' },
          category: { 
            type: 'string', 
            enum: ['race_conduct', 'medical', 'equipment', 'administrative'],
            example: 'race_conduct'
          },
          severity: { 
            type: 'string', 
            enum: ['low', 'medium', 'high', 'critical'],
            example: 'high'
          },
          penaltyApplied: { type: 'string', example: 'Tước quyền thi đấu 2 chặng' },
        },
      },
      ViolationRuleDto: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          code: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          severity: { type: 'string' },
          penaltyApplied: { type: 'string' },
          isActive: { type: 'boolean', example: true },
          createdBy: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ApplyPenaltyRequest: {
        type: 'object',
        required: ['ruleId', 'target'],
        properties: {
          ruleId: { type: 'string', description: 'ID của luật vi phạm' },
          horseId: { type: 'string', description: 'ID ngựa bị phạt nếu áp dụng cho horse hoặc both' },
          jockeyId: { type: 'string', description: 'ID jockey bị phạt nếu áp dụng cho jockey hoặc both' },
          target: {
            type: 'string',
            enum: ['horse', 'jockey', 'both'],
            description: 'Đối tượng chịu án phạt'
          },
          notes: { type: 'string', example: 'Cố tình chèn ép ở vạch đích, đã check VAR.' },
        },
      },
      // === KẾT THÚC NEW SCHEMAS ===
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
    // === NEW: ADMIN - QUẢN LÝ LUẬT VI PHẠM ===
    '/api/admin/violation-rules': {
      get: {
        tags: ['Admin'],
        summary: 'Lấy danh sách các luật xử phạt',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'isActive', in: 'query', schema: { type: 'boolean' } }
        ],
        responses: { 
          200: { 
            description: 'Danh sách luật',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/ViolationRuleDto' } }
              }
            }
          } 
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Tạo mới một luật xử phạt',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateViolationRuleRequest' } }
          }
        },
        responses: { 201: { description: 'Đã tạo luật thành công' } },
      },
    },
    '/api/admin/violation-rules/{id}': {
      patch: {
        tags: ['Admin'],
        summary: 'Cập nhật thông tin luật xử phạt',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateViolationRuleRequest' } }
          }
        },
        responses: { 200: { description: 'Cập nhật thành công' } },
      },
    },
    '/api/admin/violation-rules/{id}/toggle-status': {
      patch: {
        tags: ['Admin'],
        summary: 'Bật/Tắt trạng thái áp dụng của luật',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Đã thay đổi trạng thái' } },
      },
    },
    // === KẾT THÚC NEW ADMIN LUẬT ===
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
    '/api/admin/race-meetings': {
      get: {
        tags: ['Admin'],
        summary: 'List race meetings',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Race meeting list' } },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a race meeting',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Created race meeting' } },
      },
    },
    '/api/admin/tracks': {
      get: {
        tags: ['Admin'],
        summary: 'List race tracks',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Track list' } },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a race track',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Created track' } },
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
      delete: {
        tags: ['Tournaments'],
        summary: 'Delete a draft or published tournament',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Deleted tournament' },
          400: { description: 'Tournament cannot be deleted in its current state' },
        },
      },
    },
    '/api/tournaments/{id}/status': {
      patch: {
        tags: ['Tournaments'],
        summary: 'Update tournament status',
        description: 'Publishing or starting a tournament requires at least one race to be set up.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Updated tournament' },
          409: { description: 'Tournament cannot be published before at least one race exists' },
        },
      },
    },
    '/api/tournaments/{id}/prediction-config': {
      patch: {
        tags: ['Tournaments'],
        summary: 'Update prediction bounty pool configuration',
        description:
          'Admin-only endpoint. Allows changing entry fee, 10/15/75 pool rates, owner/jockey split, and rank reward split while the tournament is draft or published.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PredictionConfigRequest' },
            },
          },
        },
        responses: {
          200: { description: 'Updated prediction configuration' },
          409: { description: 'Tournament already started or invalid rate totals' },
        },
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
      delete: {
        tags: ['Races'],
        summary: 'Delete a race',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Deleted race' },
          409: { description: 'Race cannot be deleted in its current state' },
        },
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
      delete: {
        tags: ['Horse Owner'],
        summary: 'Delete my horse',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Deleted horse' },
          409: { description: 'Horse has active registration or cannot be deleted' },
        },
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
    '/api/horse-owner/jockeys/search': {
      get: {
        tags: ['Horse Owner'],
        summary: 'Search jockeys by name',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'name', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Jockey search results' } },
      },
    },
    '/api/horse-owner/tournaments': {
      get: {
        tags: ['Horse Owner'],
        summary: 'List tournaments available to horse owners',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
        ],
        responses: { 200: { description: 'Tournament list' } },
      },
    },
    '/api/horse-owner/tournaments/{tournamentId}/races': {
      get: {
        tags: ['Horse Owner'],
        summary: 'List races in a tournament for owner registration',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'tournamentId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Race list' } },
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
    '/api/referee/races/{id}/penalize': {
      post: {
        tags: ['Referee'],
        summary: 'Ghi nhận vi phạm và áp dụng hình phạt cho race',
        description: 'Trọng tài chọn luật vi phạm và áp dụng lên ngựa, jockey, hoặc cả hai trong race phụ trách.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Race id' }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ApplyPenaltyRequest' } }
          }
        },
        responses: { 
          200: { description: 'Đã ghi nhận hình phạt thành công' },
          400: { description: 'Luật này không tồn tại hoặc đối tượng không hợp lệ' },
          403: { description: 'Trận đua đã kết thúc, không thể phạt thêm' }
        },
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
    '/api/spectator/predictions/current': {
      get: {
        tags: ['Spectator'],
        summary: 'List my predictions',
        description:
          'Preferred prediction history endpoint. Returns predictions for the authenticated spectator using the JWT token.',
        security: [{ bearerAuth: [] }],
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
        summary: 'Create a race prediction with optional risk multiplier',
        description:
          'Creates one winner prediction for the race. If tournament predictionConfig.poolEnabled is true, the backend spends entryFee * riskMultiplier points from the spectator profile and records it as entry points.',
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
                winnerPrediction: {
                  value: {
                    raceId: '665f1e000000000000000010',
                    predictedRanks: [{ rank: 1, horseId: '665f1e000000000000000001' }],
                    riskMultiplier: 2,
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
    '/api/spectator/predictions/{id}/cancel': {
      patch: {
        tags: ['Spectator'],
        summary: 'Cancel a pending prediction and refund entry points',
        description:
          'Cancels an authenticated spectator prediction while it is still pending and the prediction window is open. Refunded points are returned to the spectator profile and the prediction is kept as cancelled for audit/history.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Prediction id' }],
        responses: {
          200: {
            description: 'Cancelled prediction and updated points',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    prediction: { $ref: '#/components/schemas/PredictionDto' },
                    points: { $ref: '#/components/schemas/SpectatorPointsDto' },
                  },
                },
              },
            },
          },
          409: { description: 'Prediction is no longer pending or prediction window is closed' },
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
    '/api/spectator/top-ups': {
      get: {
        tags: ['Spectator'],
        summary: 'List my top-up payments',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Top-up payment list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    payments: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/PaymentTransactionDto' },
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
        summary: 'Mock top-up: convert money to points',
        description: 'Creates a paid mock payment transaction and adds points to the spectator profile. Current exchange: 100 VND = 1 point; minimum top-up is 100 points.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TopUpRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Created paid top-up and updated points',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    payment: { $ref: '#/components/schemas/PaymentTransactionDto' },
                    points: { $ref: '#/components/schemas/SpectatorPointsDto' },
                  },
                },
              },
            },
          },
          400: { description: 'points is missing or below minimum' },
        },
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
