import { FastifyInstance } from "fastify";
import { TournamentService } from "@repo/core";
import { repositories } from "@repo/db";

// =============================================================================
// TOURNAMENT ROUTES
// =============================================================================
// GET  /tournaments/:id                → public
// POST /tournaments                    → protected
// POST /tournaments/:id/join           → protected
// POST /tournaments/:id/invite         → protected, creator only
// POST /tournaments/invites/:id/accept → protected, invited player only
// POST /tournaments/invites/:id/reject → protected, invited player only
// POST /tournaments/:id/start          → protected, creator only
// POST /tournaments/:id/cancel         → protected, creator only
// =============================================================================

const tournamentService = new TournamentService(repositories);

export async function tournamentRoutes(app: FastifyInstance) {
  // --------------------------------------------------------------------------
  // GET /tournaments/public
  // Returns all public active tournaments — used for the discover tab
  // Must be registered before /:id to avoid route collision
  // --------------------------------------------------------------------------

  app.get(
    "/public",
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const tournaments = await repositories.tournament.findAll(true);
      const public_ = tournaments.filter((t) => t.visibility === "PUBLIC");
      return reply.send(public_);
    }
  );

  // --------------------------------------------------------------------------
  // GET /tournaments/by-code/:code
  // Finds a tournament by invite code — used for joining private tournaments
  // Must be registered before /:id to avoid route collision
  // --------------------------------------------------------------------------

  app.get(
    "/by-code/:code",
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["code"],
          properties: { code: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const tournament = await repositories.tournament.findByInvitationCode(
        code.toUpperCase()
      );

      if (!tournament || !tournament.is_active) {
        return reply.status(404).send({
          statusCode: 404,
          error: "TOURNAMENT_NOT_FOUND",
          message: "No tournament found with that invite code",
        });
      }

      return reply.send(tournament);
    }
  );

  // --------------------------------------------------------------------------
  // GET /tournaments/mine
  // Returns tournaments created by and participated in by the logged-in player
  // Must be registered before /:id to avoid route collision
  // --------------------------------------------------------------------------

  app.get(
    "/mine",
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const player = await repositories.player.findByUserId(request.user.userId);
      if (!player) {
        return reply.status(404).send({
          statusCode: 404,
          error: "PLAYER_NOT_FOUND",
          message: "Player not found",
        });
      }

      const result = await repositories.tournament.findMineByUserId(player.id);
      return reply.send(result);
    }
  );


  // --------------------------------------------------------------------------
  // GET /tournaments/:id
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
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const tournament = await repositories.tournament.findWithPhasesAndParticipants(id);
      if (!tournament || !tournament.is_active) {
        return reply.status(404).send({
          statusCode: 404,
          error: "TOURNAMENT_NOT_FOUND",
          message: "Tournament not found",
        });
      }

      return reply.send(tournament);
    }
  );

  // --------------------------------------------------------------------------
  // POST /tournaments
  // --------------------------------------------------------------------------

  app.post(
    "/",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["name", "slug", "sportId", "visibility"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            slug: { type: "string", minLength: 1, maxLength: 100 },
            description: { type: "string", maxLength: 500 },
            sportId: { type: "string" },
            visibility: { type: "string", enum: ["PUBLIC", "PRIVATE"] },
            minPlayers: { type: "integer", minimum: 2 },
            maxPlayers: { type: "integer", minimum: 2 },
            teamBased: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        name: string;
        slug: string;
        description?: string;
        sportId: string;
        visibility: "PUBLIC" | "PRIVATE";
        minPlayers?: number;
        maxPlayers?: number;
        teamBased?: boolean;
      };

      const tournament = await tournamentService.createTournament(
        request.user.userId,
        body
      );

      return reply.status(201).send(tournament);
    }
  );

  // --------------------------------------------------------------------------
  // POST /tournaments/:id/join
  // --------------------------------------------------------------------------

  app.post(
    "/:id/join",
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: ["object", "null"],
          properties: {
            inviteCode: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { inviteCode } = (request.body as { inviteCode?: string }) ?? {};

      console.log("Join tournament request received");
      console.log("User ID: ", request.user.userId);
      console.log("Invite code: ", inviteCode);
      console.log("Tournament ID: ", id);

      const participant = await tournamentService.joinTournament(
        request.user.userId,
        inviteCode,
        id
      );

      return reply.status(201).send(participant);
    }
  );

  // --------------------------------------------------------------------------
  // POST /tournaments/:id/invite
  // --------------------------------------------------------------------------

  app.post(
    "/:id/invite",
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["playerId"],
          properties: {
            playerId: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { playerId } = request.body as { playerId: string };

      const invite = await tournamentService.invitePlayer(
        request.user.userId,
        id,
        playerId
      );

      return reply.status(201).send(invite);
    }
  );

  // --------------------------------------------------------------------------
  // POST /tournaments/invites/:id/accept
  // Note: registered before /:id to avoid route collision
  // --------------------------------------------------------------------------

  app.post(
    "/invites/:id/accept",
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const participant = await tournamentService.acceptInvite(
        request.user.userId,
        id
      );
      return reply.send(participant);
    }
  );

  // --------------------------------------------------------------------------
  // POST /tournaments/invites/:id/reject
  // --------------------------------------------------------------------------

  app.post(
    "/invites/:id/reject",
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await tournamentService.rejectInvite(request.user.userId, id);
      return reply.status(204).send();
    }
  );

  // --------------------------------------------------------------------------
  // POST /tournaments/:id/open
  // Opens registration — moves DRAFT → OPEN
  // --------------------------------------------------------------------------

  app.post(
    "/:id/open",
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tournament = await tournamentService.openTournament(
        request.user.userId,
        id
      );
      return reply.send(tournament);
    }
  );

  // --------------------------------------------------------------------------
  // POST /tournaments/:id/start
  // --------------------------------------------------------------------------

  app.post(
    "/:id/start",
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tournament = await tournamentService.startTournament(
        request.user.userId,
        id
      );
      return reply.send(tournament);
    }
  );

  // --------------------------------------------------------------------------
  // POST /tournaments/:id/cancel
  // --------------------------------------------------------------------------

  app.post(
    "/:id/cancel",
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tournament = await tournamentService.cancelTournament(
        request.user.userId,
        id
      );
      return reply.send(tournament);
    }
  );
}