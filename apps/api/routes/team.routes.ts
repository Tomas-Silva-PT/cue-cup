import { FastifyInstance } from "fastify";
import { TeamService } from "@repo/core";
import { repositories } from "@repo/db";

// =============================================================================
// TEAM ROUTES
// =============================================================================
// All mutating routes are protected — only authenticated players can
// create or modify teams.
//
// GET  /teams/:id                      → public
// POST /teams                          → protected
// PATCH /teams/:id                     → protected, owner only
// DELETE /teams/:id                    → protected, owner only
// POST /teams/:id/members              → protected, owner only
// DELETE /teams/:id/members/:playerId  → protected, owner or self
// =============================================================================

const teamService = new TeamService(repositories);

export async function teamRoutes(app: FastifyInstance) {
  // --------------------------------------------------------------------------
  // GET /teams/:id
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
      const team = await teamService.getTeam(id);
      return reply.send(team);
    }
  );

  // --------------------------------------------------------------------------
  // POST /teams
  // --------------------------------------------------------------------------

  app.post(
    "/",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["name", "slug"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 50 },
            slug: { type: "string", minLength: 1, maxLength: 50 },
            description: { type: "string", maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        name: string;
        slug: string;
        description?: string;
      };

      const team = await teamService.createTeam(request.user.userId, body);
      return reply.status(201).send(team);
    }
  );

  // --------------------------------------------------------------------------
  // PATCH /teams/:id
  // --------------------------------------------------------------------------

  app.patch(
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
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 50 },
            description: { type: "string", maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        name?: string;
        description?: string;
      };

      const team = await teamService.updateTeam(request.user.userId, id, body);
      return reply.send(team);
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /teams/:id
  // --------------------------------------------------------------------------

  app.delete(
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
      await teamService.deleteTeam(request.user.userId, id);
      return reply.status(204).send();
    }
  );

  // --------------------------------------------------------------------------
  // POST /teams/:id/members
  // --------------------------------------------------------------------------

  app.post(
    "/:id/members",
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

      const member = await teamService.addMember(
        request.user.userId,
        id,
        playerId
      );

      return reply.status(201).send(member);
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /teams/:id/members/:playerId
  // --------------------------------------------------------------------------

  app.delete(
    "/:id/members/:playerId",
    {
      preHandler: [app.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["id", "playerId"],
          properties: {
            id: { type: "string" },
            playerId: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id, playerId } = request.params as {
        id: string;
        playerId: string;
      };

      await teamService.removeMember(request.user.userId, id, playerId);
      return reply.status(204).send();
    }
  );
}
