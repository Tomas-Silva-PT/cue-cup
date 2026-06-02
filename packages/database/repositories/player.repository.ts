import { PlayerCreateInput, PlayerUpdateInput } from "../prisma/prisma";
import { BaseRepository } from "./base.repository";

export class PlayerRepository extends BaseRepository {
  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  async findById(id: string) {
    return this.db.player.findUnique({
      where: { id },
    });
  }

  async findByUserId(userId: string) {
    return this.db.player.findUnique({
      where: { user_id: userId },
      include: {
        teams: {
          include: { team: true },
        },
      },
    });
  }

  async findByNickname(nickname: string) {
    return this.db.player.findUnique({
      where: { nickname },
      include: {
        teams: { include: { team: true } },
      },
    });
  }

  async findAll() {
    return this.db.player.findMany({
      orderBy: { nickname: "asc" },
    });
  }

  // Útil para pesquisa de jogadores ao convidar para torneio ou desafio
  async search(query: string) {
    return this.db.player.findMany({
      where: {
        nickname: { contains: query, mode: "insensitive" },
      },
      orderBy: { nickname: "asc" },
    });
  }

  async findWithUser(id: string) {
    return this.db.player.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  async findWithTeams(id: string) {
    return this.db.player.findUnique({
      where: { id },
      include: {
        teams: {
          include: { team: true },
        },
      },
    });
  }

  // Histórico de matches de um jogador (via MatchParticipant)
  async findWithMatchHistory(id: string) {
    return this.db.player.findUnique({
      where: { id },
      include: {
        matchParticipants: {
          include: { match: true },
          orderBy: { created_at: "desc" },
        },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  async create(data: PlayerCreateInput) {
    return this.db.player.create({ data });
  }

  async update(id: string, data: PlayerUpdateInput) {
    return this.db.player.update({
      where: { id },
      data,
    });
  }

  // Players não têm is_active — hard delete (raramente usado)
  // A inactivação é feita via User.is_active
  async delete(id: string) {
    return this.db.player.delete({
      where: { id },
    });
  }
}