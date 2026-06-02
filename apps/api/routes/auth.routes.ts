import { FastifyInstance } from "fastify";
import { AuthService } from "@repo/core";
import { repositories } from "@repo/db";
import { config } from "../config";

// =============================================================================
// AUTH ROUTES
// =============================================================================
// Handles registration, login, token refresh and logout.
//
// All routes in this file are public — no authentication required.
// The access token and refresh token are set as HttpOnly cookies, meaning
// they are never accessible via JavaScript on the client. This is the most
// secure approach for browser-based apps.
//
// Cookie strategy:
//   access_token  → short-lived (15min), sent on every request
//   refresh_token → long-lived (7 days), only sent to /auth/refresh
// =============================================================================

const authService = new AuthService(repositories);

const COOKIE_BASE = {
  httpOnly: true,
  secure: config.nodeEnv === "production",
  sameSite: "strict",
  path: "/",
} as const;

const ACCESS_TOKEN_COOKIE = {
  ...COOKIE_BASE,
  maxAge: 60 * 15, // 15 minutes
};

const REFRESH_TOKEN_COOKIE = {
  ...COOKIE_BASE,
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: "/auth/refresh", // Refresh token is only sent to this endpoint
};

export async function authRoutes(app: FastifyInstance) {
  // --------------------------------------------------------------------------
  // POST /auth/register
  // --------------------------------------------------------------------------

  app.post(
    "/register",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password", "nickname", "name"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            nickname: { type: "string", minLength: 3, maxLength: 30 },
            name: { type: "string", minLength: 1, maxLength: 100 },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password, nickname, name } = request.body as {
        email: string;
        password: string;
        nickname: string;
        name: string;
      };

      const { accessToken, refreshToken } = await authService.register({
        email,
        password,
        nickname,
        name,
      });

      reply
        .setCookie("access_token", accessToken, ACCESS_TOKEN_COOKIE)
        .setCookie("refresh_token", refreshToken, REFRESH_TOKEN_COOKIE)
        .status(201)
        .send({ message: "Registration successful" });
    }
  );

  // --------------------------------------------------------------------------
  // POST /auth/login
  // --------------------------------------------------------------------------

  app.post(
    "/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as {
        email: string;
        password: string;
      };

      const { accessToken, refreshToken } = await authService.login({
        email,
        password,
      });

      reply
        .setCookie("access_token", accessToken, ACCESS_TOKEN_COOKIE)
        .setCookie("refresh_token", refreshToken, REFRESH_TOKEN_COOKIE)
        .send({ message: "Login successful" });
    }
  );

  // --------------------------------------------------------------------------
  // POST /auth/refresh
  // --------------------------------------------------------------------------
  // Issues a new access token using the refresh token cookie.
  // The refresh token cookie path is restricted to /auth/refresh,
  // meaning browsers only send it to this specific endpoint —
  // not to every API request.
  // --------------------------------------------------------------------------

  app.post(
    "/refresh",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const refreshToken = request.cookies["refresh_token"];

      if (!refreshToken) {
        return reply.status(401).send({
          statusCode: 401,
          error: "MISSING_REFRESH_TOKEN",
          message: "Refresh token is required",
        });
      }

      const { accessToken, refreshToken: newRefreshToken } =
        await authService.refresh(refreshToken);

      reply
        .setCookie("access_token", accessToken, ACCESS_TOKEN_COOKIE)
        .setCookie("refresh_token", newRefreshToken, REFRESH_TOKEN_COOKIE)
        .send({ message: "Token refreshed" });
    }
  );

  // --------------------------------------------------------------------------
  // POST /auth/logout
  // --------------------------------------------------------------------------
  // Invalidates the refresh token and clears both cookies.
  // Even if the refresh token is missing or already invalid,
  // the cookies are cleared and a 200 is returned — logout should
  // always succeed from the client's perspective.
  // --------------------------------------------------------------------------

  app.post(
    "/logout",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const refreshToken = request.cookies["refresh_token"];

      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      reply
        .clearCookie("access_token", { path: "/" })
        .clearCookie("refresh_token", { path: "/auth/refresh" })
        .send({ message: "Logged out successfully" });
    }
  );
}
