import { SportRepository } from "./repositories/sport.repository";
import { UserRepository } from "./repositories/user.repository";
import { PlayerRepository } from "./repositories/player.repository";
import { TeamRepository } from "./repositories/team.repository";
import { TournamentRepository } from "./repositories/tournament.repository";
import { PhaseRepository } from "./repositories/phase.repository";
import { MatchRepository } from "./repositories/match.repository";
import { SessionRepository } from "./repositories/session.repository";
import { ChallengeRepository } from "./repositories/challenge.repository";
import { ScheduleProposalRepository } from "./repositories/schedule-proposal.repository";
 
export interface Repositories {
  sport: SportRepository;
  user: UserRepository;
  player: PlayerRepository;
  team: TeamRepository;
  tournament: TournamentRepository;
  phase: PhaseRepository;
  match: MatchRepository;
  session: SessionRepository;
  challenge: ChallengeRepository;
  scheduleProposal: ScheduleProposalRepository;
}
 
export const repositories: Repositories = {
  sport: new SportRepository(),
  user: new UserRepository(),
  player: new PlayerRepository(),
  team: new TeamRepository(),
  tournament: new TournamentRepository(),
  phase: new PhaseRepository(),
  match: new MatchRepository(),
  session: new SessionRepository(),
  challenge: new ChallengeRepository(),
  scheduleProposal: new ScheduleProposalRepository(),
};