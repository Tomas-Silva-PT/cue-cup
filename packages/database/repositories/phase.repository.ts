import { Prisma, PhaseStatus, PhaseCreateInput, PhaseUpdateInput, PhaseGroupCreateInput, PhaseGroupUpdateInput } from "../prisma/prisma";
import { BaseRepository } from "./base.repository";

export class PhaseRepository extends BaseRepository {
  // -------------------------------------------------------------------------
  // Queries — Phase
  // -------------------------------------------------------------------------

  async findById(id: string) {
    return this.db.phase.findUnique({
      where: { id },
    });
  }

  async findByTournament(tournamentId: string) {
    return this.db.phase.findMany({
      where: { tournament_id: tournamentId },
      orderBy: { order: "asc" },
    });
  }

  // Fase activa de um torneio (só deve haver uma de cada vez)
  async findActiveByTournament(tournamentId: string) {
    return this.db.phase.findFirst({
      where: {
        tournament_id: tournamentId,
        status: PhaseStatus.ONGOING,
      },
    });
  }

  async findWithGroups(id: string) {
    return this.db.phase.findUnique({
      where: { id },
      include: {
        tournament: {
          select: { id: true, name: true, created_by: true },
        },
        groups: {
          orderBy: { order: "asc" },
          include: {
            phaseGroupParticipants: {
              include: {
                participant: {
                  include: { player: true },
                },
              },
            },
            matches: {
              include: {
                participants: {
                  include: { player: true },
                },
                sessions: {
                  include: { result: true },
                  orderBy: { number: "asc" },
                },
              },
              orderBy: { created_at: "asc" },
            },
          },
        },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Queries — PhaseGroup
  // -------------------------------------------------------------------------

  async findGroupById(id: string) {
    return this.db.phaseGroup.findUnique({
      where: { id },
    });
  }

  async findGroupsByPhase(phaseId: string) {
    return this.db.phaseGroup.findMany({
      where: { phase_id: phaseId },
      orderBy: { order: "asc" },
    });
  }

  async findGroupWithParticipants(id: string) {
    return this.db.phaseGroup.findUnique({
      where: { id },
      include: {
        phaseGroupParticipants: {
          include: {
            participant: {
              include: { player: true },
            },
          },
        },
      },
    });
  }

  async findGroupWithMatches(id: string) {
    return this.db.phaseGroup.findUnique({
      where: { id },
      include: {
        matches: {
          include: { participants: true },
        },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Queries — PhaseGroupParticipant
  // -------------------------------------------------------------------------

  async findGroupParticipant(groupId: string, tournamentParticipantId: string) {
    return this.db.phaseGroupParticipant.findUnique({
      where: {
        phase_group_id_tournament_participant_id: {
          phase_group_id: groupId,
          tournament_participant_id: tournamentParticipantId,
        },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Mutations — Phase
  // -------------------------------------------------------------------------

  async create(data: PhaseCreateInput) {
    return this.db.phase.create({ data });
  }

  async update(id: string, data: PhaseUpdateInput) {
    return this.db.phase.update({
      where: { id },
      data,
    });
  }

  async updateStatus(id: string, status: PhaseStatus) {
    return this.db.phase.update({
      where: { id },
      data: {
        status,
        started_at: status === PhaseStatus.ONGOING ? new Date() : undefined,
        completed_at: status === PhaseStatus.COMPLETED ? new Date() : undefined,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Mutations — PhaseGroup
  // -------------------------------------------------------------------------

  async createGroup(data: PhaseGroupCreateInput) {
    return this.db.phaseGroup.create({ data });
  }

  async updateGroup(id: string, data: PhaseGroupUpdateInput) {
    return this.db.phaseGroup.update({
      where: { id },
      data,
    });
  }

  // -------------------------------------------------------------------------
  // Mutations — PhaseGroupParticipant
  // -------------------------------------------------------------------------

  async addParticipantToGroup(groupId: string, tournamentParticipantId: string) {
    return this.db.phaseGroupParticipant.create({
      data: {
        phase_group_id: groupId,
        tournament_participant_id: tournamentParticipantId,
      },
    });
  }

  async setFinalPosition(groupId: string, tournamentParticipantId: string, position: number) {
    return this.db.phaseGroupParticipant.update({
      where: {
        phase_group_id_tournament_participant_id: {
          phase_group_id: groupId,
          tournament_participant_id: tournamentParticipantId,
        },
      },
      data: { final_position: position },
    });
  }
}
