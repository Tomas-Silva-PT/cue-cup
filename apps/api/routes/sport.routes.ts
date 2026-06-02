import { FastifyInstance } from "fastify";
import { repositories } from "@repo/db";

// =============================================================================
// SPORT ROUTES
// =============================================================================
// GET /sports       → public, lists all active sports
// GET /sports/:id   → public, fetches a single sport by id
// =============================================================================

export async function sportRoutes(app: FastifyInstance) {
  // --------------------------------------------------------------------------
  // GET /sports
  // --------------------------------------------------------------------------

  app.get(
    "/",
    {
      schema: {
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                slug: { type: "string" },
                description: { type: "string", nullable: true },
                rules: {},
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const sports = await repositories.sport.findAll(true);
      return reply.send(sports);
    }
  );

  // --------------------------------------------------------------------------
  // GET /sports/:id
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
      const sport = await repositories.sport.findById(id);

      if (!sport || !sport.is_active) {
        return reply.status(404).send({
          statusCode: 404,
          error: "SPORT_NOT_FOUND",
          message: "Sport not found",
        });
      }

      return reply.send(sport);
    }
  );
}