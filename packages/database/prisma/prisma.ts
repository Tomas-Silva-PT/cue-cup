import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const Prisma = new PrismaClient({ adapter });

export { Prisma };

// Export const objects (values) — allows ScheduleProposalStatus.ACCEPTED syntax
export {
  UserRole,
  TeamMemberRole,
  TournamentStatus,
  TournamentVisibility,
  TournamentParticipantStatus,
  TournamentInviteStatus,
  PhaseType,
  PhaseStatus,
  MatchStatus,
  MatchSide,
  MatchContext,
  SessionStatus,
  ResultStatus,
  ResultConfirmationMethod,
  ChallengeStatus,
  ScheduleProposalStatus,
} from "../generated/prisma/enums";

// Export types separately
// export type {
//   UserRole as UserRoleType,
//   TeamMemberRole as TeamMemberRoleType,
//   TournamentStatus as TournamentStatusType,
//   TournamentVisibility as TournamentVisibilityType,
//   TournamentParticipantStatus as TournamentParticipantStatusType,
//   TournamentInviteStatus as TournamentInviteStatusType,
//   PhaseType as PhaseTypeType,
//   PhaseStatus as PhaseStatusType,
//   MatchStatus as MatchStatusType,
//   MatchSide as MatchSideType,
//   MatchContext as MatchContextType,
//   SessionStatus as SessionStatusType,
//   ResultStatus as ResultStatusType,
//   ResultConfirmationMethod as ResultConfirmationMethodType,
//   ChallengeStatus as ChallengeStatusType,
//   ScheduleProposalStatus as ScheduleProposalStatusType,
// } from "../generated/prisma/enums";

export * from "../generated/prisma/models";