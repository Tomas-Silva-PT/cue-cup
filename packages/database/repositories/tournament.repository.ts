import { TournamentParticipantStatus, TournamentInviteStatus, TournamentCreateInput, TournamentUpdateInput, TournamentInviteCreateInput } from "../prisma/prisma";
import { BaseRepository } from "./base.repository";

export class TournamentRepository extends BaseRepository {
  // -------------------------------------------------------------------------
  // Queries — Tournament
  // -------------------------------------------------------------------------

  async findById(id: string) {
    return this.db.tournament.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string) {
    return this.db.tournament.findUnique({
      where: { slug },
    });
  }

  async findByInvitationCode(code: string) {
    return this.db.tournament.findUnique({
      where: { invitation_code: code },
    });
  }

  async findAll(onlyActive = true) {
    return this.db.tournament.findMany({
      where: onlyActive ? { is_active: true } : undefined,
      orderBy: { created_at: "desc" },
    });
  }

  // Torneios criados por um jogador
  async findByCreator(playerId: string) {
    return this.db.tournament.findMany({
      where: { created_by: playerId, is_active: true },
      orderBy: { created_at: "desc" },
    });
  }

  // Torneios em que um jogador participa
  async findByParticipant(playerId: string) {
    return this.db.tournament.findMany({
      where: {
        tournamentParticipants: {
          some: { player_id: playerId },
        },
        is_active: true,
      },
      orderBy: { created_at: "desc" },
    });
  }

  async findWithPhases(id: string) {
    return this.db.tournament.findUnique({
      where: { id },
      include: {
        phases: {
          orderBy: { order: "asc" },
          include: {
            groups: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });
  }

  async findWithParticipants(id: string) {
    return this.db.tournament.findUnique({
      where: { id },
      include: {
        tournamentParticipants: {
          include: { player: true },
        },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Queries — TournamentParticipant
  // -------------------------------------------------------------------------

  async findParticipant(tournamentId: string, playerId: string) {
    return this.db.tournamentParticipant.findUnique({
      where: {
        tournament_id_player_id: {
          tournament_id: tournamentId,
          player_id: playerId,
        },
      },
    });
  }

  async findParticipantById(id: string) {
    return this.db.tournamentParticipant.findUnique({
      where: { id },
    });
  }

  async findParticipants(tournamentId: string) {
    return this.db.tournamentParticipant.findMany({
      where: { tournament_id: tournamentId },
      include: { player: true },
    });
  }

  // -------------------------------------------------------------------------
  // Queries — TournamentInvite
  // -------------------------------------------------------------------------

  async findInvite(id: string) {
    return this.db.tournamentInvite.findUnique({
      where: { id },
    });
  }

  async findInviteByPlayer(tournamentId: string, playerId: string) {
    return this.db.tournamentInvite.findFirst({
      where: {
        tournament_id: tournamentId,
        invited_player_id: playerId,
        status: TournamentInviteStatus.PENDING,
      },
    });
  }

  async findPendingInvitesByPlayer(playerId: string) {
    return this.db.tournamentInvite.findMany({
      where: {
        invited_player_id: playerId,
        status: TournamentInviteStatus.PENDING,
      },
      include: { tournament: true, sender: true },
    });
  }

  // -------------------------------------------------------------------------
  // Mutations — Tournament
  // -------------------------------------------------------------------------

  async create(data: TournamentCreateInput) {
    return this.db.tournament.create({ data });
  }

  async update(id: string, data: TournamentUpdateInput) {
    return this.db.tournament.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.db.tournament.update({
      where: { id },
      data: { is_active: false },
    });
  }

  // -------------------------------------------------------------------------
  // Mutations — TournamentParticipant
  // -------------------------------------------------------------------------

  async addParticipant(tournamentId: string, playerId: string, teamId?: string) {
    return this.db.tournamentParticipant.create({
      data: {
        tournament_id: tournamentId,
        player_id: playerId,
        team_id: teamId,
      },
    });
  }

  async updateParticipantStatus(id: string, status: TournamentParticipantStatus) {
    return this.db.tournamentParticipant.update({
      where: { id },
      data: { status },
    });
  }

  // -------------------------------------------------------------------------
  // Mutations — TournamentInvite
  // -------------------------------------------------------------------------

  async createInvite(data: TournamentInviteCreateInput) {
    return this.db.tournamentInvite.create({ data });
  }

  async updateInviteStatus(id: string, status: TournamentInviteStatus) {
    return this.db.tournamentInvite.update({
      where: { id },
      data: {
        status,
        responded_at: new Date(),
      },
    });
  }
}
