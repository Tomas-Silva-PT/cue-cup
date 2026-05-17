import { RefreshTokenCreateInput, UserCreateInput, UserUpdateInput } from "../prisma/prisma";
import { BaseRepository } from "./base.repository";

export class UserRepository extends BaseRepository {
  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  async findById(id: string) {
    return this.db.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string) {
    return this.db.user.findUnique({
      where: { email },
    });
  }

  // Inclui o player associado — útil para autenticação e sessão
  async findByIdWithPlayer(id: string) {
    return this.db.user.findUnique({
      where: { id },
      include: { player: true },
    });
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  async create(data: UserCreateInput) {
    return this.db.user.create({ data });
  }

  async update(id: string, data: UserUpdateInput) {
    return this.db.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.db.user.update({
      where: { id },
      data: { is_active: false },
    });
  }

  // -------------------------------------------------------------------------
  // Refresh Tokens
  // -------------------------------------------------------------------------
 
  async findRefreshToken(token: string) {
    return this.db.refreshToken.findUnique({
      where: { token },
    });
  }
 
  async createRefreshToken(data: RefreshTokenCreateInput) {
    return this.db.refreshToken.create({ data });
  }
 
  async deleteRefreshToken(token: string) {
    return this.db.refreshToken.delete({
      where: { token },
    });
  }
 
  // Invalidate all refresh tokens for a user — useful for "logout all devices"
  async deleteAllRefreshTokens(userId: string) {
    return this.db.refreshToken.deleteMany({
      where: { user_id: userId },
    });
  }
}
