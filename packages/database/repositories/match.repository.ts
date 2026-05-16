import { MatchStatus, MatchSide, MatchParticipantCreateInput, MatchUpdateInput, MatchCreateInput } from "../prisma/prisma";
import { BaseRepository } from "./base.repository";

export class MatchRepository extends BaseRepository {
  // -------------------------------------------------------------------------
  // Queries — Match
  // -------------------------------------------------------------------------

  async findById(id: string) {
    return this.db.match.findUnique({
      where: { id },
    });
  }

  async findByGroup(groupId: string) {
    return this.db.match.findMany({
      where: { phase_group_id: groupId },
      orderBy: { created_at: "asc" },
    });
  }

  async findByChallenge(challengeId: string) {
    return this.db.match.findMany({
      where: { challenge_id: challengeId },
      orderBy: { created_at: "asc" },
    });
  }

  // Todos os matches de um jogador independentemente do contexto
  async findByPlayer(playerId: string) {
    return this.db.match.findMany({
      where: {
        participants: {
          some: { player_id: playerId },
        },
      },
      orderBy: { created_at: "desc" },
    });
  }

  async findWithParticipants(id: string) {
    return this.db.match.findUnique({
      where: { id },
      include: {
        participants: {
          include: { player: true },
        },
      },
    });
  }

  async findWithSessions(id: string) {
    return this.db.match.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { number: "asc" },
          include: { result: true },
        },
      },
    });
  }

  async findWithScheduleProposals(id: string) {
    return this.db.match.findUnique({
      where: { id },
      include: {
        scheduleProposals: {
          orderBy: { created_at: "desc" },
        },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Queries — MatchParticipant
  // -------------------------------------------------------------------------

  async findParticipant(matchId: string, playerId: string) {
    return this.db.matchParticipant.findUnique({
      where: {
        match_id_player_id: { match_id: matchId, player_id: playerId },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Mutations — Match
  // -------------------------------------------------------------------------

  async create(data: MatchCreateInput) {
    return this.db.match.create({ data });
  }

  async update(id: string, data: MatchUpdateInput) {
    return this.db.match.update({
      where: { id },
      data,
    });
  }

  async updateStatus(id: string, status: MatchStatus) {
    return this.db.match.update({
      where: { id },
      data: { status },
    });
  }

  async setWinner(id: string, winner: MatchSide) {
    return this.db.match.update({
      where: { id },
      data: {
        winner,
        status: MatchStatus.COMPLETED,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Mutations — MatchParticipant
  // -------------------------------------------------------------------------

  async addParticipant(data: MatchParticipantCreateInput) {
    return this.db.matchParticipant.create({ data });
  }
}
