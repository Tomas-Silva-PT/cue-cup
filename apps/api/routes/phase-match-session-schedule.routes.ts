import { FastifyInstance } from "fastify";
import { PhaseService, MatchService, SessionService, ScheduleService } from "@repo/core";
import { repositories } from "@repo/db";

// =============================================================================
// PHASE ROUTES
// =============================================================================
// All nested under /tournaments/:tournamentId/phases
// =============================================================================

const phaseService = new PhaseService(repositories);

export async function phaseRoutes(app: FastifyInstance) {
  // GET /tournaments/:tournamentId/phases/:phaseId
  app.get(
    "/:tournamentId/phases/:phaseId",
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["tournamentId", "phaseId"],
          properties: {
            tournamentId: { type: "string" },
            phaseId: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { phaseId } = request.params as {
        tournamentId: string;
        phaseId: string;
      };
      const phase = await phaseService.getPhase(phaseId);
      return reply.send(phase);
    }
  );

  // POST /tournaments/:tournamentId/phases
  app.post(
    "/:tournamentId/phases",
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["tournamentId"],
          properties: {
            tournamentId: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["name", "order", "type", "config"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            order: { type: "integer", minimum: 1 },
            type: {
              type: "string",
              enum: [
                "ROUND_ROBIN",
                "SINGLE_ELIMINATION",
                "DOUBLE_ELIMINATION",
                "SWISS",
                "LEAGUE",
              ],
            },
            config: { type: "object" },
          },
        },
      },
    },
    async (request, reply) => {
      const { tournamentId } = request.params as { tournamentId: string };
      const body = request.body as any;

      const phase = await phaseService.createPhase(
        request.user.userId,
        tournamentId,
        body
      );

      return reply.status(201).send(phase);
    }
  );

  // POST /tournaments/:tournamentId/phases/:phaseId/start
  app.post(
    "/:tournamentId/phases/:phaseId/start",
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["tournamentId", "phaseId"],
          properties: {
            tournamentId: { type: "string" },
            phaseId: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { tournamentId, phaseId } = request.params as {
        tournamentId: string;
        phaseId: string;
      };

      const phase = await phaseService.startPhase(
        request.user.userId,
        tournamentId,
        phaseId
      );

      return reply.send(phase);
    }
  );

  // POST /tournaments/:tournamentId/phases/:phaseId/complete
  app.post(
    "/:tournamentId/phases/:phaseId/complete",
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["tournamentId", "phaseId"],
          properties: {
            tournamentId: { type: "string" },
            phaseId: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { phaseId } = request.params as {
        tournamentId: string;
        phaseId: string;
      };

      const phase = await phaseService.completePhase(
        request.user.userId,
        phaseId
      );

      return reply.send(phase);
    }
  );
}

// =============================================================================
// MATCH ROUTES
// =============================================================================

const matchService = new MatchService(repositories);

export async function matchRoutes(app: FastifyInstance) {
  // GET /matches
  // Returns matches for the logged-in player, optionally filtered by status
  app.get(
    "/",
    {
      preHandler: [app.authenticate],
      schema: {
        querystring: {
          type: "object",
          properties: {
            status: { type: "string" },
            limit: { type: "integer", minimum: 1, maximum: 50 },
          },
        },
      },
    },
    async (request, reply) => {
      const { status, limit } = request.query as {
        status?: string;
        limit?: number;
      };

      const player = await repositories.player.findByUserId(
        request.user.userId
      );

      if (!player) {
        return reply.status(404).send({
          statusCode: 404,
          error: "PLAYER_NOT_FOUND",
          message: "Player not found",
        });
      }

      const statuses = status
        ? status.split(",").map((s) => s.trim())
        : undefined;

      const matches = await repositories.match.findByPlayerAndStatus(
        player.id,
        statuses,
        limit
      );

      return reply.send(matches);
    }
  );

  // GET /matches/:id
  app.get(
    "/:id",
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
      const match = await matchService.getMatch(id);
      return reply.send(match);
    }
  );

  // POST /matches/:id/start
  app.post(
    "/:id/start",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const match = await matchService.startMatch(request.user.userId, id);
      return reply.send(match);
    }
  );

  // POST /matches/:id/pause
  app.post(
    "/:id/pause",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const match = await matchService.pauseMatch(request.user.userId, id);
      return reply.send(match);
    }
  );

  // POST /matches/:id/resume
  app.post(
    "/:id/resume",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const match = await matchService.resumeMatch(request.user.userId, id);
      return reply.send(match);
    }
  );

  // POST /matches/:id/complete
  app.post(
    "/:id/complete",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const match = await matchService.completeMatch(request.user.userId, id);
      return reply.send(match);
    }
  );

  // Participants call this to forfeit (no body needed — they lose automatically)
  // Tournament creator calls this with winningSide to award a walkover
  app.post(
    "/:id/walkover",
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { winningSide } = (request.body as { winningSide?: "HOME" | "AWAY" }) ?? {};
      const match = await matchService.walkover(
        request.user.userId,
        id,
        winningSide
      );
      return reply.send(match);
    }
  );

  // POST /matches/:id/standings
  app.post(
    "/:id/standings",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const standings = await matchService.calculateGroupStandings(id);
      return reply.send(standings);
    }
  );
}

// =============================================================================
// SESSION ROUTES
// =============================================================================

const sessionService = new SessionService(repositories);

export async function sessionRoutes(app: FastifyInstance) {
  // GET /sessions/:id
  app.get(
    "/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const session = await sessionService.getSession(id);
      return reply.send(session);
    }
  );

  // POST /sessions/:id/result
  app.post(
    "/:id/result",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["scoreHome", "scoreAway"],
          properties: {
            scoreHome: { type: "integer", minimum: 0 },
            scoreAway: { type: "integer", minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { scoreHome, scoreAway } = request.body as {
        scoreHome: number;
        scoreAway: number;
      };

      const session = await sessionService.proposeResult(
        request.user.userId,
        id,
        scoreHome,
        scoreAway
      );

      return reply.send(session);
    }
  );

  // POST /sessions/:id/result/confirm
  app.post(
    "/:id/result/confirm",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await sessionService.confirmResult(
        request.user.userId,
        id
      );
      return reply.send(result);
    }
  );

  // POST /sessions/:id/result/dispute
  app.post(
    "/:id/result/dispute",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await sessionService.disputeResult(
        request.user.userId,
        id
      );
      return reply.send(result);
    }
  );

  // POST /sessions/:id/result/resolve
  app.post(
    "/:id/result/resolve",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["scoreHome", "scoreAway"],
          properties: {
            scoreHome: { type: "integer", minimum: 0 },
            scoreAway: { type: "integer", minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { scoreHome, scoreAway } = request.body as {
        scoreHome: number;
        scoreAway: number;
      };

      const result = await sessionService.resolveDispute(
        request.user.userId,
        id,
        scoreHome,
        scoreAway
      );

      return reply.send(result);
    }
  );
}

// =============================================================================
// SCHEDULE ROUTES
// =============================================================================

const scheduleService = new ScheduleService(repositories);

export async function scheduleRoutes(app: FastifyInstance) {
  // GET /schedule/matches/:matchId
  app.get(
    "/matches/:matchId",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { matchId } = request.params as { matchId: string };
      const proposals = await scheduleService.getMatchSchedule(matchId);
      return reply.send(proposals);
    }
  );

  // POST /schedule/matches/:matchId/propose
  app.post(
    "/matches/:matchId/propose",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["datetime"],
          properties: {
            datetime: { type: "string", format: "date-time" },
            location: { type: "string", maxLength: 200 },
            note: { type: "string", maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const { matchId } = request.params as { matchId: string };
      const { datetime, location, note } = request.body as {
        datetime: string;
        location?: string;
        note?: string;
      };

      const proposal = await scheduleService.proposeSchedule(
        request.user.userId,
        matchId,
        new Date(datetime),
        location,
        note
      );

      return reply.status(201).send(proposal);
    }
  );

  // POST /schedule/proposals/:id/accept
  app.post(
    "/proposals/:id/accept",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const proposal = await scheduleService.acceptSchedule(
        request.user.userId,
        id
      );
      return reply.send(proposal);
    }
  );

  // POST /schedule/proposals/:id/reject
  app.post(
    "/proposals/:id/reject",
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { responseNote } = (request.body as { responseNote?: string }) ?? {};

      const proposal = await scheduleService.rejectSchedule(
        request.user.userId,
        id,
        responseNote
      );

      return reply.send(proposal);
    }
  );
}