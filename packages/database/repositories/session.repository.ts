import { SessionStatus, ResultStatus, ResultConfirmationMethod, SessionUpdateInput, SessionCreateInput,  ResultCreateInput } from "../prisma/prisma";
import { BaseRepository } from "./base.repository";

export class SessionRepository extends BaseRepository {
  // -------------------------------------------------------------------------
  // Queries — Session
  // -------------------------------------------------------------------------

  async findById(id: string) {
    return this.db.session.findUnique({
      where: { id },
    });
  }

  async findByMatch(matchId: string) {
    return this.db.session.findMany({
      where: { match_id: matchId },
      orderBy: { number: "asc" },
    });
  }

  // Sessão activa de um match (só deve haver uma de cada vez)
  async findActiveByMatch(matchId: string) {
    return this.db.session.findFirst({
      where: {
        match_id: matchId,
        status: SessionStatus.IN_PROGRESS,
      },
    });
  }

  async findWithResult(id: string) {
    return this.db.session.findUnique({
      where: { id },
      include: { result: true },
    });
  }

  // Próximo número de sessão para um match
  async nextSessionNumber(matchId: string): Promise<number> {
    const last = await this.db.session.findFirst({
      where: { match_id: matchId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    return (last?.number ?? 0) + 1;
  }

  // -------------------------------------------------------------------------
  // Queries — Result
  // -------------------------------------------------------------------------

  async findResultById(id: string) {
    return this.db.result.findUnique({
      where: { id },
    });
  }

  async findResultBySession(sessionId: string) {
    return this.db.result.findUnique({
      where: { session_id: sessionId },
    });
  }

  // -------------------------------------------------------------------------
  // Mutations — Session
  // -------------------------------------------------------------------------

  async create(data: SessionCreateInput) {
    return this.db.session.create({ data });
  }

  async update(id: string, data: SessionUpdateInput) {
    return this.db.session.update({
      where: { id },
      data,
    });
  }

  async complete(id: string) {
    return this.db.session.update({
      where: { id },
      data: {
        status: SessionStatus.COMPLETED,
        ended_at: new Date(),
      },
    });
  }

  async cancel(id: string) {
    return this.db.session.update({
      where: { id },
      data: {
        status: SessionStatus.CANCELED,
        ended_at: new Date(),
      },
    });
  }

  // -------------------------------------------------------------------------
  // Mutations — Result
  // -------------------------------------------------------------------------

  async createResult(data: ResultCreateInput) {
    return this.db.result.create({ data });
  }

  // Actualiza o resultado e anexa a entrada anterior ao histórico
  async updateResult(
    sessionId: string,
    data: { score_home: number; score_away: number; proposed_by: string }
  ) {
    const current = await this.findResultBySession(sessionId);

    if (!current) {
      throw new Error(`Result not found for session ${sessionId}`);
    }

    const historyEntry = {
      score_home: current.score_home,
      score_away: current.score_away,
      changed_by: data.proposed_by,
      changed_at: new Date().toISOString(),
    };

    const currentHistory = Array.isArray(current.history) ? current.history : [];

    return this.db.result.update({
      where: { session_id: sessionId },
      data: {
        score_home: data.score_home,
        score_away: data.score_away,
        proposed_by: data.proposed_by,
        status: ResultStatus.PROPOSED,
        confirmed_at: null,
        confirmedBy: null,
        history: [...currentHistory, historyEntry],
      },
    });
  }

  async confirmResult(sessionId: string, confirmedBy: string, method: ResultConfirmationMethod) {
    return this.db.result.update({
      where: { session_id: sessionId },
      data: {
        status: ResultStatus.CONFIRMED,
        confirmation_method: method,
        confirmedBy,
        confirmed_at: new Date(),
      },
    });
  }

  async disputeResult(sessionId: string) {
    return this.db.result.update({
      where: { session_id: sessionId },
      data: { status: ResultStatus.DISPUTED },
    });
  }
}
