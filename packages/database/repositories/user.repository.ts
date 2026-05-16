import { UserCreateInput, UserUpdateInput } from "../prisma/prisma";
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
}
