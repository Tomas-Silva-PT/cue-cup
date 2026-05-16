import { ScheduleProposalCreateInput, ScheduleProposalStatus } from "../prisma/prisma";
import { BaseRepository } from "./base.repository";

export class ScheduleProposalRepository extends BaseRepository {
  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  async findById(id: string) {
    return this.db.scheduleProposal.findUnique({
      where: { id },
    });
  }

  async findByMatch(matchId: string) {
    return this.db.scheduleProposal.findMany({
      where: { match_id: matchId },
      orderBy: { created_at: "desc" },
    });
  }

  // Proposta activa de um match (só deve haver uma PENDING de cada vez)
  async findPendingByMatch(matchId: string) {
    return this.db.scheduleProposal.findFirst({
      where: {
        match_id: matchId,
        status: ScheduleProposalStatus.PENDING,
      },
      orderBy: { created_at: "desc" },
    });
  }

  // Propostas pendentes recebidas por um jogador (a aguardar resposta)
  async findPendingReceivedByPlayer(playerId: string) {
    return this.db.scheduleProposal.findMany({
      where: {
        responded_by: playerId,
        status: ScheduleProposalStatus.PENDING,
      },
      include: { match: true, proposer: true },
      orderBy: { created_at: "desc" },
    });
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  async create(data: ScheduleProposalCreateInput) {
    return this.db.scheduleProposal.create({ data });
  }

  async respond(
    id: string,
    status: ScheduleProposalStatus,
    respondedBy: string,
    responseNote?: string
  ) {
    return this.db.scheduleProposal.update({
      where: { id },
      data: {
        status,
        responded_by: respondedBy,
        response_note: responseNote,
        responded_at: new Date(),
      },
    });
  }

  async expire(id: string) {
    return this.db.scheduleProposal.update({
      where: { id },
      data: { status: ScheduleProposalStatus.EXPIRED },
    });
  }

  // Expira todas as propostas pendentes de um match (quando uma nova é criada)
  async expireAllPendingByMatch(matchId: string) {
    return this.db.scheduleProposal.updateMany({
      where: {
        match_id: matchId,
        status: ScheduleProposalStatus.PENDING,
      },
      data: { status: ScheduleProposalStatus.EXPIRED },
    });
  }
}
