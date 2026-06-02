import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { AuthService, AuthError } from "@repo/core";
import { repositories } from "@repo/db";

// =============================================================================
// AUTH PLUGIN
// =============================================================================
// Responsible for two things:
//
//   1. Decorating the Fastify instance with an `authenticate` hook that
//      route handlers can use to protect their endpoints. Any route that
//      calls `request.jwtVerify()` will require a valid access token.
//
//   2. Augmenting the Fastify request type so that after authentication,
//      `request.user` is available with the userId and role from the token.
//
// Using a plugin (via fastify-plugin) means these decorations are available
// globally across all routes, not scoped to a single plugin context.
//
// The access token is read from the HttpOnly cookie set at login.
// If the token is missing or invalid, a 401 is returned automatically.
// =============================================================================

declare module "fastify" {
  interface FastifyRequest {
    user: {
      userId: string;
      role: string;
    };
  }
}

const authService = new AuthService(repositories);

async function authPlugin(fastify: FastifyInstance) {
  // Decorate the request object with a placeholder so Fastify
  // knows the `user` property exists on every request
  fastify.decorateRequest("user", null);

  // `authenticate` is a preHandler hook that can be added to any route
  // to require a valid access token before the handler runs
  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const token = request.cookies["access_token"];

      if (!token) {
        return reply.status(401).send({
          statusCode: 401,
          error: "MISSING_ACCESS_TOKEN",
          message: "Access token is required",
        });
      }

      try {
        const payload = authService.verifyAccessToken(token);
        request.user = payload;
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.status(401).send({
            statusCode: 401,
            error: error.code,
            message: error.message,
          });
        }
        throw error;
      }
    }
  );
}

// Augment the FastifyInstance type to include the `authenticate` decorator
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}

export default fp(authPlugin, {
  name: "auth-plugin",
});
