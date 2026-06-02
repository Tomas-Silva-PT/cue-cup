import { FastifyInstance } from "fastify";
import { PlayerService } from "@repo/core";
import { repositories } from "@repo/db";

// =============================================================================
// PLAYER ROUTES
// =============================================================================
// Handles player profile operations.
//
// GET /players/me        → protected, returns the logged-in player's profile
// GET /players/:id       → public, returns any player's profile
// PATCH /players/me      → protected, updates the logged-in player's profile
//
// Note: /me routes always come before /:id routes in registration order.
// If /:id were registered first, Fastify would match /me as an id parameter
// and the dedicated /me handler would never be reached.
// =============================================================================

const playerService = new PlayerService(repositories);

export async function playerRoutes(app: FastifyInstance) {
  // --------------------------------------------------------------------------
  // GET /players/search?q=
  // Searches players by nickname — used when sending a challenge
  // Must be registered before /:id to avoid route collision
  // --------------------------------------------------------------------------

  app.get(
    "/search",
    {
      preHandler: [app.authenticate],
      schema: {
        querystring: {
          type: "object",
          required: ["q"],
          properties: {
            q: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { q } = request.query as { q: string };
      const players = await repositories.player.search(q);
      return reply.send(players);
    }
  );

  // --------------------------------------------------------------------------
  // GET /players/me
  // --------------------------------------------------------------------------

  app.get(
    "/me",
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              nickname: { type: "string" },
              bio: { type: "string", nullable: true },
              created_at: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const player = await playerService.getMyProfile(request.user.userId);
      return reply.send(player);
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /players/me
  // --------------------------------------------------------------------------

  app.patch(
    "/me",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          properties: {
            nickname: { type: "string", minLength: 3, maxLength: 30 },
            bio: { type: "string", maxLength: 500 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              nickname: { type: "string" },
              bio: { type: "string", nullable: true },
              updated_at: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        nickname?: string;
        bio?: string;
      };

      const player = await playerService.updateProfile(
        request.user.userId,
        body
      );

      return reply.send(player);
    }
  );

  // --------------------------------------------------------------------------
  // GET /players/nickname/:nickname
  // Fetch a player by nickname — used for public profile pages
  // Must be registered before /:id to avoid route collision
  // --------------------------------------------------------------------------

  app.get(
    "/nickname/:nickname",
    {
      schema: {
        params: {
          type: "object",
          required: ["nickname"],
          properties: {
            nickname: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { nickname } = request.params as { nickname: string };
      const player = await repositories.player.findByNickname(nickname);

      if (!player) {
        return reply.status(404).send({
          statusCode: 404,
          error: "PLAYER_NOT_FOUND",
          message: "Player not found",
        });
      }

      return reply.send(player);
    }
  );

  // --------------------------------------------------------------------------
  // GET /players/:id/matches
  // Fetch completed matches for a specific player — used for public profile
  // --------------------------------------------------------------------------

  app.get(
    "/:id/matches",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 50 },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { limit } = request.query as { limit?: number };

      const player = await repositories.player.findById(id);
      if (!player) {
        return reply.status(404).send({
          statusCode: 404,
          error: "PLAYER_NOT_FOUND",
          message: "Player not found",
        });
      }

      const matches = await repositories.match.findByPlayerAndStatus(
        id,
        ["COMPLETED"],
        limit ?? 20
      );

      return reply.send(matches);
    }
  );

  // --------------------------------------------------------------------------
  // GET /players/:id
  // --------------------------------------------------------------------------

  app.get(
    "/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              nickname: { type: "string" },
              bio: { type: "string", nullable: true },
              created_at: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const player = await playerService.getProfile(id);
      return reply.send(player);
    }
  );
}