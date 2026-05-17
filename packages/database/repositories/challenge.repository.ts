import { ChallengeStatus, ChallengeCreateInput, ChallengeUpdateInput } from "../prisma/prisma";
import { BaseRepository } from "./base.repository";

export class ChallengeRepository extends BaseRepository {
  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  async findById(id: string) {
    return this.db.challenge.findUnique({
      where: { id },
    });
  }

  // Desafios enviados por um jogador
  async findSentByPlayer(playerId: string) {
    return this.db.challenge.findMany({
      where: { challenger_id: playerId, is_active: true },
      orderBy: { created_at: "desc" },
    });
  }

  // Desafios recebidos por um jogador
  async findReceivedByPlayer(playerId: string) {
    return this.db.challenge.findMany({
      where: { challenged_id: playerId, is_active: true },
      orderBy: { created_at: "desc" },
    });
  }

  // Desafios pendentes recebidos (a aguardar resposta)
  async findPendingReceivedByPlayer(playerId: string) {
    return this.db.challenge.findMany({
      where: {
        challenged_id: playerId,
        status: ChallengeStatus.PENDING,
        is_active: true,
      },
      orderBy: { created_at: "desc" },
    });
  }

  // Histórico de desafios entre dois jogadores
  async findBetweenPlayers(playerAId: string, playerBId: string) {
    return this.db.challenge.findMany({
      where: {
        OR: [
          { challenger_id: playerAId, challenged_id: playerBId },
          { challenger_id: playerBId, challenged_id: playerAId },
        ],
        is_active: true,
      },
      orderBy: { created_at: "desc" },
    });
  }

  async findWithMatches(id: string) {
    return this.db.challenge.findUnique({
      where: { id },
      include: {
        matches: {
          include: {
            participants: { include: { player: true } },
            sessions: { include: { result: true } },
          },
        },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  async create(data: ChallengeCreateInput) {
    return this.db.challenge.create({ data });
  }

  async update(id: string, data: ChallengeUpdateInput) {
    return this.db.challenge.update({
      where: { id },
      data,
    });
  }

  async updateStatus(id: string, status: ChallengeStatus) {
    return this.db.challenge.update({
      where: { id },
      data: {
        status,
        responded_at:
          status !== ChallengeStatus.PENDING ? new Date() : undefined,
      },
    });
  }

  async delete(id: string) {
    return this.db.challenge.update({
      where: { id },
      data: { is_active: false },
    });
  }
}
