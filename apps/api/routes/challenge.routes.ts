import { FastifyInstance } from "fastify";
import { ChallengeService } from "@repo/core";
import { repositories } from "@repo/db";
import type { JsonValue } from "@repo/core";

// =============================================================================
// CHALLENGE ROUTES
// =============================================================================
// GET  /challenges/mine          → protected, returns sent + received challenges
// GET  /challenges/:id           → protected, participant only
// POST /challenges               → protected, sends a challenge
// POST /challenges/:id/accept    → protected, challenged player only
// POST /challenges/:id/reject    → protected, challenged player only
// POST /challenges/:id/withdraw  → protected, challenger only
// =============================================================================

const challengeService = new ChallengeService(repositories);

export async function challengeRoutes(app: FastifyInstance) {
  // --------------------------------------------------------------------------
  // GET /challenges/mine
  // --------------------------------------------------------------------------

  app.get(
    "/mine",
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const challenges = await challengeService.getMyChallenges(
        request.user.userId
      );
      return reply.send(challenges);
    }
  );

  // --------------------------------------------------------------------------
  // GET /challenges/:id
  // --------------------------------------------------------------------------

  app.get(
    "/:id",
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
      const challenge = await challengeService.getChallenge(id);
      return reply.send(challenge);
    }
  );

  // --------------------------------------------------------------------------
  // POST /challenges
  // --------------------------------------------------------------------------



  app.post(
    "/",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["challengedId", "sportId"],
          properties: {
            challengedId: { type: "string" },
            sportId: { type: "string" },
            requestNote: { type: "string", maxLength: 500 },
            config: { type: "object" },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        challengedId: string;
        sportId: string;
        requestNote?: string;
        config?: JsonValue;
      };

      const challenge = await challengeService.send(
        request.user.userId,
        body
      );

      return reply.status(201).send(challenge);
    }
  );

  // --------------------------------------------------------------------------
  // POST /challenges/:id/accept
  // --------------------------------------------------------------------------

  app.post(
    "/:id/accept",
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
      const challenge = await challengeService.accept(
        request.user.userId,
        id
      );
      return reply.send(challenge);
    }
  );

  // --------------------------------------------------------------------------
  // POST /challenges/:id/reject
  // --------------------------------------------------------------------------

  app.post(
    "/:id/reject",
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
          properties: {
            responseNote: { type: "string", maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { responseNote } = (request.body as { responseNote?: string }) ?? {};

      const challenge = await challengeService.reject(
        request.user.userId,
        id,
        responseNote
      );

      return reply.send(challenge);
    }
  );

  // --------------------------------------------------------------------------
  // POST /challenges/:id/withdraw
  // --------------------------------------------------------------------------

  app.post(
    "/:id/withdraw",
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
      const challenge = await challengeService.withdraw(
        request.user.userId,
        id
      );
      return reply.send(challenge);
    }
  );
}
