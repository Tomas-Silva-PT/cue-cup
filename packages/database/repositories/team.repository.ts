import { TeamCreateInput, TeamMemberRole, TeamUpdateInput } from "../prisma/prisma";
import { BaseRepository } from "./base.repository";

export class TeamRepository extends BaseRepository {
  // -------------------------------------------------------------------------
  // Queries — Team
  // -------------------------------------------------------------------------

  async findById(id: string) {
    return this.db.team.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string) {
    return this.db.team.findUnique({
      where: { slug },
    });
  }

  async findAll(onlyActive = true) {
    return this.db.team.findMany({
      where: onlyActive ? { is_active: true } : undefined,
      orderBy: { name: "asc" },
    });
  }

  async findWithMembers(id: string) {
    return this.db.team.findUnique({
      where: { id },
      include: {
        members: {
          include: { player: true },
        },
      },
    });
  }

  // Equipas a que um jogador pertence
  async findByPlayer(playerId: string) {
    return this.db.team.findMany({
      where: {
        members: {
          some: { player_id: playerId },
        },
        is_active: true,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Queries — TeamMember
  // -------------------------------------------------------------------------

  async findMember(teamId: string, playerId: string) {
    return this.db.teamMember.findUnique({
      where: {
        team_id_player_id: { team_id: teamId, player_id: playerId },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Mutations — Team
  // -------------------------------------------------------------------------

  async create(data: TeamCreateInput) {
    return this.db.team.create({ data });
  }

  async update(id: string, data: TeamUpdateInput) {
    return this.db.team.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.db.team.update({
      where: { id },
      data: { is_active: false },
    });
  }

  // -------------------------------------------------------------------------
  // Mutations — TeamMember
  // -------------------------------------------------------------------------

  async addMember(teamId: string, playerId: string, role: TeamMemberRole = TeamMemberRole.MEMBER) {
    return this.db.teamMember.create({
      data: { team_id: teamId, player_id: playerId, role },
    });
  }

  async updateMemberRole(teamId: string, playerId: string, role: TeamMemberRole) {
    return this.db.teamMember.update({
      where: {
        team_id_player_id: { team_id: teamId, player_id: playerId },
      },
      data: { role },
    });
  }

  async removeMember(teamId: string, playerId: string) {
    return this.db.teamMember.delete({
      where: {
        team_id_player_id: { team_id: teamId, player_id: playerId },
      },
    });
  }
}
