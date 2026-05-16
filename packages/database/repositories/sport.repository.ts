import { SportCreateInput, SportUpdateInput } from "../prisma/prisma";
import { BaseRepository } from "./base.repository";

export class SportRepository extends BaseRepository {
  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  async findById(id: string) {
    return this.db.sport.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string) {
    return this.db.sport.findUnique({
      where: { slug },
    });
  }

  async findAll(onlyActive = true) {
    return this.db.sport.findMany({
      where: onlyActive ? { is_active: true } : undefined,
      orderBy: { name: "asc" },
    });
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  async create(data: SportCreateInput) {
    return this.db.sport.create({ data });
  }

  async update(id: string, data: SportUpdateInput) {
    return this.db.sport.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.db.sport.update({
      where: { id },
      data: { is_active: false },
    });
  }
}
