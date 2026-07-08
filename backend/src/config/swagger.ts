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
          ticketCount: {
            type: 'integer',
            minimum: 1,
            example: 2,
            description: 'Number of prediction tickets to buy. Total cost = entryFee * ticketCount.',
          },
          riskMultiplier: {
            type: 'integer',
            minimum: 1,
            deprecated: true,
            example: 2,
            description: 'Deprecated compatibility alias for ticketCount.',
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
            description: 'Prediction entry points paid into the bounty pool: entryFee * ticketCount.',
          },
          ticketCount: {
            type: 'integer',
            example: 2,
            description: 'Number of prediction tickets bought for this prediction.',
          },
          riskMultiplier: {
            type: 'integer',
            example: 2,
            deprecated: true,
            description: 'Deprecated compatibility alias. Use ticketCount.',
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
        description:
          'Prediction bounty pool settlement formula used when admin publishes race results. Points are internal credits; current exchange for top-up is 1000 VND = 1 point.',
        properties: {
          totalBountyPool: {
            type: 'string',
            example: 'sum(entryFee * ticketCount) across all predictions',
          },
          winPool: {
            type: 'string',
            example: 'sum(entryFee * ticketCount) from incorrect winner predictions',
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
            example:
              'Correct spectator receives returned contribution + spectatorRewardPool * (predictionScore / totalWinnerScore), where predictionScore = ticketCount.',
          },
          noWinnerPolicy: {
            type: 'string',
            example:
              'If totalWinnerScore is 0, rolloverPolicy controls the spectator reward pool: refund, rollover_next_race, or to_organizer.',
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
          entryFee: {
            type: 'number',
            example: 50000,
            description: 'Price of one prediction ticket in points.',
          },
          minRiskMultiplier: { type: 'integer', minimum: 1, example: 1 },
          maxRiskMultiplier: { type: 'integer', minimum: 1, example: 10 },
          quickRiskMultipliers: {
            type: 'array',
            items: { type: 'integer', minimum: 1 },
            example: [1],
            deprecated: true,
            description: 'Deprecated compatibility field. Ticket-based predictions should send ticketCount.',
          },
          organizerFeeRate: { type: 'number', example: 10 },
          racingRewardRate: { type: 'number', example: 15 },
          spectatorRewardRate: { type: 'number', example: 75 },
          ownerShareRate: {
            type: 'number',
            example: 80,
            description: 'Owner share for both fixed race prizes and bounty racing rewards.',
          },
          jockeyShareRate: {
            type: 'number',
            example: 20,
            description: 'Jockey share for both fixed race prizes and bounty racing rewards.',
          },
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
            description: 'Minimum top-up is 100 points. Current exchange rate is 1000 VND = 1 point.',
          },
        },
      },
      PayosTopUpResponse: {
        type: 'object',
        properties: {
          payment: { $ref: '#/components/schemas/PaymentTransactionDto' },
          paymentUrl: {
            type: 'string',
            format: 'uri',
            description: 'Redirect the spectator browser to this PayOS checkout URL.',
          },
        },
      },
      PaymentTransactionDto: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          provider: { type: 'string', example: 'payos' },
          amountVnd: { type: 'number', example: 100000 },
          points: { type: 'integer', example: 100 },
          exchangeRateVndPerPoint: { type: 'number', example: 1000 },
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
                type: {
                  type: 'string',
                  example: 'spent_pool_entry',
                  description:
                    'Point ledger type. Betting flow uses topup, spent_pool_entry, refunded_pool, earned_pool_share, earned_race_prize_owner, earned_race_prize_jockey, spent_viewing_ticket, and spent_redemption.',
                },
                points: { type: 'number', example: 100 },
                balanceAfter: { type: 'number', example: 1000 },
                note: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      SpectatorRacePredictionConfig: {
        type: 'object',
        description:
          'Public prediction settings needed by FE/mobile before creating a prediction.',
        properties: {
          isEnabled: { type: 'boolean', example: true },
          poolEnabled: { type: 'boolean', example: true },
          entryFee: {
            type: 'integer',
            minimum: 100,
            example: 50000,
            description: 'Price of one prediction ticket. Final cost is entryFee * ticketCount.',
          },
          ticketPrice: {
            type: 'integer',
            minimum: 100,
            example: 50000,
            description: 'Alias for entryFee, exposed for clearer FE/mobile labels.',
          },
          quickRiskMultipliers: {
            type: 'array',
            items: { type: 'integer', minimum: 1 },
            example: [1],
            deprecated: true,
            description: 'Deprecated compatibility field. FE/mobile should use ticketCount input instead.',
          },
        },
      },
      ViewingTicketInfoDto: {
        type: 'object',
        properties: {
          requiresTicket: { type: 'boolean', example: false },
          hasPass: { type: 'boolean', example: false },
          canPurchase: { type: 'boolean', example: false },
          pricePoints: { type: 'integer', example: 200 },
          announceAt: { type: 'string', format: 'date-time', nullable: true },
          saleOpensAt: { type: 'string', format: 'date-time', nullable: true },
          saleExpiresAt: { type: 'string', format: 'date-time', nullable: true },
          announcementMessage: { type: 'string', nullable: true },
          allowVipRedemption: { type: 'boolean', example: false },
        },
      },
      SpectatorRaceDto: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string', example: 'Chung kết — Vòng 1' },
          round: { type: 'integer', example: 1 },
          scheduledAt: { type: 'string', format: 'date-time' },
          status: {
            type: 'string',
            enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
          },
          distance: { type: 'number', example: 1600 },
          tournament: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
          participants: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                laneNumber: { type: 'integer', example: 1 },
                ticketCount: {
                  type: 'integer',
                  example: 12,
                  description: 'Current number of prediction tickets placed on this horse for the race.',
                },
              },
            },
          },
          canPredict: {
            type: 'boolean',
            description:
              'True only when prediction is enabled, race is scheduled, window is open, participant list is non-empty, and spectator has no active prediction.',
          },
          hasPrediction: { type: 'boolean' },
          predictionOpenAt: { type: 'string', format: 'date-time', nullable: true },
          predictionCloseAt: { type: 'string', format: 'date-time', nullable: true },
          predictionConfig: { $ref: '#/components/schemas/SpectatorRacePredictionConfig' },
          viewingTicket: { $ref: '#/components/schemas/ViewingTicketInfoDto' },
          streamUrl: { type: 'string', nullable: true },
          result: { type: 'object', nullable: true },
        },
      },
      CreateRaceRequest: {
        type: 'object',
        required: ['tournamentId', 'name', 'round', 'scheduledAt', 'maxParticipants'],
        properties: {
          tournamentId: { type: 'string', example: '665f1e000000000000000100' },
          name: { type: 'string', example: 'Final Heat 1' },
          round: { type: 'integer', example: 1 },
          raceClass: { type: 'string', example: 'Open' },
          scheduledAt: { type: 'string', format: 'date-time' },
          distance: { type: 'number', example: 1600 },
          surface: { type: 'string', enum: ['turf', 'dirt', 'synthetic'], example: 'turf' },
          going: { type: 'string', enum: ['firm', 'good', 'soft', 'heavy'], example: 'good' },
          weather: { type: 'string', example: 'Clear' },
          predictionOpenAt: { type: 'string', format: 'date-time', nullable: true },
          predictionCloseAt: { type: 'string', format: 'date-time', nullable: true },
          maxParticipants: { type: 'integer', minimum: 2, example: 8 },
          refereeId: { type: 'string', nullable: true },
          streamUrl: { type: 'string', format: 'uri', nullable: true },
          viewingTicket: { $ref: '#/components/schemas/ViewingTicketConfig' },
        },
      },
      ViewingTicketConfig: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', example: true },
          pricePoints: { type: 'integer', minimum: 0, example: 200 },
          announceAt: { type: 'string', format: 'date-time', nullable: true },
          saleOpensAt: { type: 'string', format: 'date-time', nullable: true },
          saleExpiresAt: { type: 'string', format: 'date-time', nullable: true },
          announcementMessage: { type: 'string', example: 'VIP live stream ticket is now available.' },
          allowVipRedemption: { type: 'boolean', example: true },
        },
      },
      UpdateRaceStatusRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['scheduled', 'ongoing', 'completed', 'cancelled'] },
        },
      },
      CreateRaceMeetingRequest: {
        type: 'object',
        required: ['tournamentId', 'trackId', 'meetingDate', 'name'],
        properties: {
          tournamentId: { type: 'string' },
          trackId: { type: 'string' },
          meetingDate: { type: 'string', format: 'date-time' },
          name: { type: 'string', example: 'Opening race day' },
          status: { type: 'string', enum: ['scheduled', 'completed', 'cancelled'], example: 'scheduled' },
        },
      },
      CreateTrackRequest: {
        type: 'object',
        required: ['name', 'location', 'countryCode'],
        properties: {
          name: { type: 'string', example: 'Binh Duong Racecourse' },
          location: { type: 'string', example: 'Thu Dau Mot, Binh Duong' },
          countryCode: { type: 'string', example: 'VN' },
          surfaceDefault: { type: 'string', enum: ['turf', 'dirt', 'synthetic'], example: 'turf' },
          isActive: { type: 'boolean', example: true },
        },
      },
      ToggleRaceCheckRequest: {
        type: 'object',
        required: ['horseId', 'field'],
        properties: {
          horseId: { type: 'string' },
          field: { type: 'string', enum: ['vetApprovedAt', 'confirmedAt'] },
        },
      },
      UpsertRaceResultRequest: {
        type: 'object',
        properties: {
          rankings: {
            type: 'array',
            items: {
              type: 'object',
              required: ['rank', 'horseId'],
              properties: {
                rank: { type: 'integer', minimum: 1 },
                horseId: { type: 'string' },
                jockeyId: { type: 'string' },
                finishTime: { type: 'number', example: 98.42 },
                marginBehind: { type: 'number', example: 0 },
                prize: {
                  type: 'number',
                  example: 30000000,
                  description:
                    'Fixed race prize in points for this rank. On publish it is split to owner/jockey by ownerShareRate/jockeyShareRate.',
                },
              },
            },
          },
        },
      },
      RedeemProductRequest: {
        type: 'object',
        required: ['productId'],
        properties: {
          productId: { type: 'string' },
          quantity: { type: 'integer', minimum: 1, default: 1 },
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
          affectedHorseId: { type: 'string', description: 'Required for demote: horse that was affected by the violation' },
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
        summary: 'Publish a race result and settle prizes',
        description:
          'Publishes confirmed race results and settles the point betting pool plus fixed race prizes. Correct spectators receive returned contribution plus spectator pool share; owner and jockey rewards are added to their point ledgers from both the bounty racing reward pool and each ranking.prize using ownerShareRate/jockeyShareRate; organizer fee is recorded in OrganizerLedger. If no prediction qualifies, rolloverPolicy controls refund, jackpot rollover, or transfer to organizer.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Result published; bounty pool and fixed race prize settlement attempted',
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
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'tournamentId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Race meeting list' } },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a race meeting',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateRaceMeetingRequest' } },
          },
        },
        responses: { 201: { description: 'Created race meeting' } },
      },
    },
    '/api/admin/tracks': {
      get: {
        tags: ['Admin'],
        summary: 'List race tracks',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'isActive', in: 'query', schema: { type: 'boolean' } }],
        responses: { 200: { description: 'Track list' } },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a race track',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateTrackRequest' } },
          },
        },
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
          'Admin-only endpoint. Allows changing ticket price, pool distribution, owner/jockey split, rank reward split, rolloverPolicy, and minScoreToShare while the tournament is draft or published. Pool distribution and rank reward rates must each sum to 100.',
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
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateRaceRequest' } },
          },
        },
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
    '/api/races/{id}/status': {
      patch: {
        tags: ['Races'],
        summary: 'Update race status',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateRaceStatusRequest' } },
          },
        },
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
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'breed', 'age'],
                properties: {
                  name: { type: 'string', example: 'Thunder Echo' },
                  registrationId: { type: 'string', example: 'VN-HRS-2026-001' },
                  breed: { type: 'string', example: 'Thoroughbred' },
                  age: { type: 'integer', minimum: 1, maximum: 30, example: 4 },
                  weight: { type: 'number', minimum: 350, maximum: 600, example: 460 },
                  color: { type: 'string', example: 'Bay' },
                  trainerName: { type: 'string', example: 'Nguyen Van A' },
                  profilePdfUrl: {
                    type: 'string',
                    format: 'uri',
                    example: 'https://example.com/horses/thunder-echo-profile.pdf',
                    description: 'Optional PDF URL for pedigree, health certificate, or profile document.',
                  },
                  profilePdfName: { type: 'string', example: 'Health certificate' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Created horse' } },
      },
    },
    '/api/horse-owner/horses/{id}': {
      patch: {
        tags: ['Horse Owner'],
        summary: 'Update horse information',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  registrationId: { type: 'string' },
                  breed: { type: 'string' },
                  age: { type: 'integer', minimum: 1, maximum: 30 },
                  weight: { type: 'number', minimum: 350, maximum: 600 },
                  color: { type: 'string' },
                  trainerName: { type: 'string' },
                  profilePdfUrl: {
                    type: 'string',
                    format: 'uri',
                    description: 'Optional PDF URL for horse documents. Must point to a .pdf file.',
                  },
                  profilePdfName: { type: 'string' },
                },
              },
            },
          },
        },
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
    '/api/referee/races/{id}/start-simulation': {
      post: {
        tags: ['Referee'],
        summary: 'Simulate a race and create a draft result',
        description: 'Generates randomized finish times for active participants, stores a draft result, and marks the race completed for referee review.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Race id' }],
        responses: {
          200: { description: 'Draft result generated' },
          409: { description: 'Race is completed/cancelled or has fewer than two active participants' },
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
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ToggleRaceCheckRequest' } },
          },
        },
        responses: { 200: { description: 'Updated check' } },
      },
    },
    '/api/races/{id}/participants': {
      post: {
        tags: ['Races'],
        summary: 'Add a participant to the race (barrier is assigned randomly)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AddParticipantRequest' } } }
        },
        responses: { 201: { description: 'Added participant' } },
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
        requestBody: {
          required: false,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpsertRaceResultRequest' } },
          },
        },
        responses: { 200: { description: 'Updated result' } },
      },
    },
    '/api/referee/races/{id}/penalties/{violationId}': {
      delete: {
        tags: ['Referee'],
        summary: 'Revoke a race penalty',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Race id' },
          { name: 'violationId', in: 'path', required: true, schema: { type: 'string' }, description: 'Violation id' },
        ],
        responses: {
          200: { description: 'Penalty revoked and horse/jockey state restored when applicable' },
          404: { description: 'Violation not found' },
        },
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
        description:
          'Returns races visible to the spectator. FE/mobile should use canPredict plus predictionConfig.ticketPrice/entryFee to calculate point betting cost as ticketPrice * ticketCount before calling create prediction.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'filter', in: 'query', schema: { type: 'string', enum: ['open', 'upcoming', 'completed'] } },
        ],
        responses: {
          200: {
            description: 'Race list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    races: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/SpectatorRaceDto' },
                    },
                  },
                },
                examples: {
                  openPredictionRace: {
                    value: {
                      races: [
                        {
                          id: '665f1e000000000000000010',
                          name: 'Chung kết — Vòng 1',
                          round: 1,
                          scheduledAt: '2026-07-05T09:00:00.000Z',
                          status: 'scheduled',
                          tournament: { id: '665f1e000000000000000100', name: 'Giải Đua Mùa Xuân 2026' },
                          participants: [
                            { id: '665f1e000000000000000001', name: 'Sóng Gió', laneNumber: 1, ticketCount: 12 },
                          ],
                          canPredict: true,
                          hasPrediction: false,
                          predictionOpenAt: '2026-07-01T00:00:00.000Z',
                          predictionCloseAt: '2026-07-05T08:30:00.000Z',
                          predictionConfig: {
                            isEnabled: true,
                            poolEnabled: true,
                            entryFee: 50000,
                            ticketPrice: 50000,
                            quickRiskMultipliers: [1],
                          },
                          viewingTicket: {
                            requiresTicket: false,
                            hasPass: false,
                            canPurchase: false,
                            pricePoints: 0,
                            announceAt: null,
                            saleOpensAt: null,
                            saleExpiresAt: null,
                            allowVipRedemption: false,
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/spectator/races/{id}': {
      get: {
        tags: ['Spectator'],
        summary: 'Get spectator race details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Race details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    race: { $ref: '#/components/schemas/SpectatorRaceDto' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/spectator/races/{id}/viewing-pass': {
      post: {
        tags: ['Spectator'],
        summary: 'Purchase a race viewing pass',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          201: { description: 'Created viewing pass and spent points' },
          409: { description: 'Already has pass, insufficient points, or sale has expired' },
        },
      },
    },
    '/api/spectator/viewing-passes': {
      get: {
        tags: ['Spectator'],
        summary: 'List my viewing passes',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'filter', in: 'query', schema: { type: 'string', enum: ['upcoming'] } }],
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
        summary: 'Create a race prediction with ticket count',
        description:
          'Creates one winner prediction for the race. If tournament predictionConfig.poolEnabled is true, the backend spends entryFee * ticketCount points from the spectator profile and records a spent_pool_entry ledger transaction. If saving the prediction fails after spending points, the backend attempts to refund the entry points.',
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
                    ticketCount: 2,
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
          400: { description: 'Invalid race id, horse id, rank payload, or ticketCount' },
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
        description:
          'Returns the spectator point wallet. Transactions are ordered newest first and include top-up, prediction entry spend, prediction refunds, pool rewards, viewing ticket spend, and redemption spend.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Points data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    points: { $ref: '#/components/schemas/SpectatorPointsDto' },
                  },
                },
              },
            },
          },
        },
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
        description:
          'Creates a paid mock payment transaction and adds points to the spectator profile. Current exchange: 1000 VND = 1 point; minimum top-up is 100 points. Intended for local/demo testing and can be disabled by environment config.',
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
          403: { description: 'Mock top-up is disabled on this environment' },
        },
      },
    },
    '/api/spectator/top-ups/payos': {
      post: {
        tags: ['Spectator'],
        summary: 'Create a PayOS top-up checkout URL',
        description: 'Creates a pending PayOS payment transaction. Redirect the spectator to paymentUrl, then PayOS calls the public webhook/return/cancel endpoints.',
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
            description: 'Created pending PayOS transaction and checkout URL',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PayosTopUpResponse' },
              },
            },
          },
          500: { description: 'PayOS credentials are not configured' },
        },
      },
    },
    '/api/payments/payos/return': {
      get: {
        tags: ['Spectator'],
        summary: 'PayOS browser return callback',
        description: 'Public callback used by PayOS after the customer completes payment. Confirms the order locally for demo and redirects to frontend when configured.',
        parameters: [{ name: 'orderCode', in: 'query', schema: { type: 'string' } }],
        responses: { 200: { description: 'Payment result JSON or frontend redirect if configured' } },
      },
    },
    '/api/payments/payos/cancel': {
      get: {
        tags: ['Spectator'],
        summary: 'PayOS browser cancel callback',
        description: 'Public callback used by PayOS when the customer cancels payment.',
        parameters: [{ name: 'orderCode', in: 'query', schema: { type: 'string' } }],
        responses: { 200: { description: 'Payment cancellation JSON or frontend redirect if configured' } },
      },
    },
    '/api/payments/payos/webhook': {
      post: {
        tags: ['Spectator'],
        summary: 'PayOS webhook callback',
        description: 'Public server-to-server callback used by PayOS. Verifies signature and idempotently confirms the top-up.',
        responses: { 200: { description: 'PayOS code and desc' } },
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
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RedeemProductRequest' } },
          },
        },
        responses: {
          201: { description: 'Created redemption. VIP race-viewing vouchers may grant a RaceViewingPass.' },
          409: { description: 'Insufficient points or product is out of stock' },
        },
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
