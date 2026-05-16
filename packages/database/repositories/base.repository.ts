import { Prisma } from "../prisma/prisma";

export abstract class BaseRepository {
  protected readonly db = Prisma;
}
