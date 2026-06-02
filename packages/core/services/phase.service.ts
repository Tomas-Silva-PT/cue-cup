import { Repositories } from "@repo/db";

// =============================================================================
// TYPES
// =============================================================================

interface CreatePhaseInput {
  name: string;
  description?: string;
  order: number;
  type: "ROUND_ROBIN" | "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION" | "SWISS" | "LEAGUE";
  config: PhaseConfig;
}

interface PhaseConfig {
  matchGeneration: "auto" | "manual";
  seeding?: "random" | "by_seed";
  bestOf?: number;
  advanceTopN?: number;
  tiebreak?: string[];
  groups?: number;           // ROUND_ROBIN / LEAGUE — how many groups to split into (default: 1)
  rounds?: number;           // SWISS
  thirdPlaceMatch?: boolean; // SINGLE_ELIMINATION
  pointsWin?: number;        // LEAGUE
  pointsDraw?: number;       // LEAGUE
  pointsLoss?: number;       // LEAGUE
}

// =============================================================================
// ERRORS
// =============================================================================

export class PhaseError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "PhaseError";
  }
}

// =============================================================================
// SERVICE
// =============================================================================

export class PhaseService {
  constructor(private readonly repos: Repositories) {}

  // ---------------------------------------------------------------------------
  // CREATE PHASE
  // Only the tournament creator can add phases
  // Phases can only be added while the tournament is in DRAFT or OPEN status
  // ---------------------------------------------------------------------------

  async createPhase(userId: string, tournamentId: string, input: CreatePhaseInput) {
    const { tournament } = await this.resolveCreator(userId, tournamentId);

    if (tournament.status !== "DRAFT" && tournament.status !== "OPEN") {
      throw new PhaseError(
        "Phases can only be added before the tournament starts",
        "INVALID_STATUS"
      );
    }

    // Ensure order is unique within the tournament
    const existingPhases = await this.repos.phase.findByTournament(tournamentId);
    const orderTaken = existingPhases.some((p) => p.order === input.order);
    if (orderTaken) {
      throw new PhaseError(
        `A phase with order ${input.order} already exists`,
        "ORDER_TAKEN"
      );
    }

    return this.repos.phase.create({
      tournament: { connect: { id: tournamentId } },
      name: input.name,
      description: input.description,
      order: input.order,
      type: input.type,
      config: input.config,
    });
  }

  // ---------------------------------------------------------------------------
  // GET PHASE
  // ---------------------------------------------------------------------------

  async getPhase(phaseId: string) {
    const phase = await this.repos.phase.findWithGroups(phaseId);

    if (!phase) {
      throw new PhaseError("Phase not found", "PHASE_NOT_FOUND");
    }

    return phase;
  }

  // ---------------------------------------------------------------------------
  // START PHASE
  // Activates a phase and generates matches if matchGeneration is "auto"
  // Only the tournament creator can start a phase
  // ---------------------------------------------------------------------------

  async startPhase(userId: string, tournamentId: string, phaseId: string) {
    const { tournament } = await this.resolveCreator(userId, tournamentId);

    if (tournament.status !== "ONGOING") {
      throw new PhaseError(
        "Tournament must be ongoing to start a phase",
        "TOURNAMENT_NOT_ONGOING"
      );
    }

    const phase = await this.repos.phase.findById(phaseId);
    if (!phase || phase.tournament_id !== tournamentId) {
      throw new PhaseError("Phase not found", "PHASE_NOT_FOUND");
    }

    if (phase.status !== "PENDING") {
      throw new PhaseError("Phase has already been started", "PHASE_ALREADY_STARTED");
    }

    // Only one phase can be active at a time
    const activePhase = await this.repos.phase.findActiveByTournament(tournamentId);
    if (activePhase) {
      throw new PhaseError(
        "Another phase is already active. Complete it before starting the next one.",
        "PHASE_ALREADY_ACTIVE"
      );
    }

    // Get participants for this phase
    // Phase 1 → all confirmed tournament participants
    // Phase N → participants who advanced from the previous phase
    const participants = await this.getPhaseParticipants(tournamentId, phase.order);

    if (participants.length < 2) {
      throw new PhaseError(
        "Not enough participants to start this phase",
        "NOT_ENOUGH_PARTICIPANTS"
      );
    }

    const config = phase.config as unknown as PhaseConfig;

    // Create groups based on phase type
    const groups = await this.createGroups(phase.id, phase.type, participants, config);

    // Mark phase as active
    await this.repos.phase.updateStatus(phaseId, "ONGOING");

    // Generate matches if auto
    if (config.matchGeneration === "auto") {
      await this.generateMatches(phase.type, groups, config);
    }

    return this.repos.phase.findWithGroups(phaseId);
  }

  // ---------------------------------------------------------------------------
  // COMPLETE PHASE
  // Marks a phase as completed
  // Only the tournament creator can complete a phase
  // ---------------------------------------------------------------------------

  async completePhase(userId: string, phaseId: string) {
    const phase = await this.repos.phase.findById(phaseId);
    if (!phase) {
      throw new PhaseError("Phase not found", "PHASE_NOT_FOUND");
    }

    await this.resolveCreator(userId, phase.tournament_id);

    if (phase.status !== "ONGOING") {
      throw new PhaseError("Phase is not ongoing", "PHASE_NOT_ONGOING");
    }

    // Verify all matches in this phase are completed
    const groups = await this.repos.phase.findGroupsByPhase(phaseId);
    for (const group of groups) {
      const groupWithMatches = await this.repos.phase.findGroupWithMatches(group.id);
      const incomplete = groupWithMatches?.matches.filter(
        (m) => m.status !== "COMPLETED" && m.status !== "WALKOVER" && m.status !== "CANCELED"
      );
      if (incomplete && incomplete.length > 0) {
        throw new PhaseError(
          "All matches must be completed before closing the phase",
          "INCOMPLETE_MATCHES"
        );
      }
    }

    return this.repos.phase.updateStatus(phaseId, "COMPLETED");
  }

  // ---------------------------------------------------------------------------
  // PRIVATE — GET PHASE PARTICIPANTS
  // ---------------------------------------------------------------------------

  private async getPhaseParticipants(tournamentId: string, phaseOrder: number) {
    if (phaseOrder === 1) {
      // First phase — all confirmed tournament participants
      const all = await this.repos.tournament.findParticipants(tournamentId);
      return all.filter((p) => p.status === "ACCEPTED");
    }

    // Subsequent phases — find who advanced from the previous phase
    const phases = await this.repos.phase.findByTournament(tournamentId);
    const previousPhase = phases.find((p) => p.order === phaseOrder - 1);

    if (!previousPhase || previousPhase.status !== "COMPLETED") {
      throw new PhaseError(
        "Previous phase must be completed before starting this one",
        "PREVIOUS_PHASE_NOT_COMPLETED"
      );
    }

    const groups = await this.repos.phase.findGroupsByPhase(previousPhase.id);
    const advanced = [];

    for (const group of groups) {
      const withParticipants = await this.repos.phase.findGroupWithParticipants(group.id);
      const sorted = (withParticipants?.phaseGroupParticipants ?? [])
        .filter((p) => p.final_position !== null)
        .sort((a, b) => (a.final_position ?? 0) - (b.final_position ?? 0));

      const config = previousPhase.config as unknown as PhaseConfig;
      const advanceTopN = config.advanceTopN ?? 1;
      advanced.push(...sorted.slice(0, advanceTopN).map((p) => p.participant));
    }

    return advanced;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE — CREATE GROUPS
  // ---------------------------------------------------------------------------

  private async createGroups(
    phaseId: string,
    phaseType: string,
    participants: any[],
    config: PhaseConfig,
  ) {
    const seeded = this.seedParticipants(participants, config.seeding ?? "random");

    if (
      phaseType === "SINGLE_ELIMINATION" ||
      phaseType === "DOUBLE_ELIMINATION" ||
      phaseType === "SWISS"
    ) {
      // Always a single group for bracket/pool formats
      const groupName = phaseType === "SWISS" ? "Pool" : "Bracket";
      const group = await this.repos.phase.createGroup({
        phase: { connect: { id: phaseId } },
        name: groupName,
        order: 1,
      });

      for (const participant of seeded) {
        await this.repos.phase.addParticipantToGroup(group.id, participant.id);
      }

      return [{ group, participants: seeded }];
    }

    if (phaseType === "ROUND_ROBIN" || phaseType === "LEAGUE") {
      const numberOfGroups = config.groups ?? 1;

      if (numberOfGroups === 1) {
        // Single group — all participants together
        const group = await this.repos.phase.createGroup({
          phase: { connect: { id: phaseId } },
          name: "Group A",
          order: 1,
        });

        for (const participant of seeded) {
          await this.repos.phase.addParticipantToGroup(group.id, participant.id);
        }

        return [{ group, participants: seeded }];
      }

      // Multiple groups — split participants evenly using snake seeding
      // Snake seeding distributes participants fairly:
      // Group A gets picks 1, 2N, 2N+1...
      // Group B gets picks 2, 2N-1, 2N+2...
      // This ensures groups are balanced in strength when seeding is used
      const groupBuckets: any[][] = Array.from({ length: numberOfGroups }, () => []);
      const groupNames = this.generateGroupNames(numberOfGroups);

      seeded.forEach((participant, index) => {
        // Snake pattern: 0→0, 1→1, 2→2, 3→2, 4→1, 5→0, 6→0...
        const cycle = Math.floor(index / numberOfGroups);
        const posInCycle = index % numberOfGroups;
        const groupIndex =
          cycle % 2 === 0 ? posInCycle : numberOfGroups - 1 - posInCycle;
        groupBuckets[groupIndex]!.push(participant);
      });

      // Create all groups and assign participants
      const result = [];
      for (let i = 0; i < numberOfGroups; i++) {
        const group = await this.repos.phase.createGroup({
          phase: { connect: { id: phaseId } },
          name: groupNames[i] ?? `Group ${i + 1}`,
          order: i + 1,
        });

        const groupParticipants = groupBuckets[i] ?? [];
        for (const participant of groupParticipants) {
          await this.repos.phase.addParticipantToGroup(group.id, participant.id);
        }

        result.push({ group, participants: groupParticipants });
      }

      return result;
    }

    throw new PhaseError(`Unsupported phase type: ${phaseType}`, "UNSUPPORTED_PHASE_TYPE");
  }

  // Generates group names: A, B, C... Z, AA, AB...
  private generateGroupNames(count: number): string[] {
    const names = [];
    for (let i = 0; i < count; i++) {
      if (i < 26) {
        names.push(`Group ${String.fromCharCode(65 + i)}`);
      } else {
        const first = String.fromCharCode(65 + Math.floor(i / 26) - 1);
        const second = String.fromCharCode(65 + (i % 26));
        names.push(`Group ${first}${second}`);
      }
    }
    return names;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE — GENERATE MATCHES
  // ---------------------------------------------------------------------------

  private async generateMatches(
    phaseType: string,
    groups: { group: any; participants: any[] }[],
    config: PhaseConfig,
  ) {
    for (const { group, participants } of groups) {
      switch (phaseType) {
        case "ROUND_ROBIN":
        case "LEAGUE":
          await this.generateRoundRobinMatches(group.id, participants, config);
          break;
        case "SINGLE_ELIMINATION":
          await this.generateSingleEliminationMatches(group.id, participants, config);
          break;
        case "DOUBLE_ELIMINATION":
          await this.generateDoubleEliminationMatches(group.id, participants, config);
          break;
        case "SWISS":
          // Swiss only generates round 1 upfront
          await this.generateSwissRound(group.id, participants, config, 1);
          break;
      }
    }
  }

  // Round Robin — every participant plays against every other participant once
  private async generateRoundRobinMatches(
    groupId: string,
    participants: any[],
    config: PhaseConfig,
  ) {
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        await this.repos.match.create({
            context: "TOURNAMENT",
            status: "AWAITING_SCHEDULE",
            phaseGroup: { connect: { id: groupId } },
            participants: {
              create: [
                { player_id: participants[i].player_id, side: "HOME" },
                { player_id: participants[j].player_id, side: "AWAY" },
              ],
            },
        });
      }
    }
  }

  // Single Elimination — pair participants: 1st vs last, 2nd vs 2nd-to-last...
  private async generateSingleEliminationMatches(
    groupId: string,
    participants: any[],
    config: PhaseConfig,
  ) {
    const pairs = this.bracketPairs(participants);

    for (const [home, away] of pairs) {
      if (!away) {
        // Odd number of participants — home gets a walkover
        await this.repos.match.create({
            context: "TOURNAMENT",
            status: "WALKOVER",
            winner: "HOME",
            phaseGroup: { connect: { id: groupId } },
            participants: {
              create: [
                { player_id: home.player_id, side: "HOME" },
              ],
            },
        });
        continue;
      }

      await this.repos.match.create({
          context: "TOURNAMENT",
          status: "AWAITING_SCHEDULE",
          phaseGroup: { connect: { id: groupId } },
          participants: {
            create: [
              { player_id: home.player_id, side: "HOME" },
              { player_id: away.player_id, side: "AWAY" },
            ],
        },
      });
    }
  }

  // Double Elimination — same as single for the first round (upper bracket)
  // Lower bracket matches are generated as players are eliminated
  private async generateDoubleEliminationMatches(
    groupId: string,
    participants: any[],
    config: PhaseConfig,
  ) {
    // Generate upper bracket round 1 — same as single elimination
    await this.generateSingleEliminationMatches(groupId, participants, config);
  }

  // Swiss Round — pair participants by similar record
  // Round 1 is random, subsequent rounds are by standings
  private async generateSwissRound(
    groupId: string,
    participants: any[],
    config: PhaseConfig,
    roundNumber: number,
  ) {
    const shuffled = this.shuffle([...participants]);
    const pairs = [];

    for (let i = 0; i < shuffled.length - 1; i += 2) {
      pairs.push([shuffled[i], shuffled[i + 1]]);
    }

    // Odd participant gets a bye (walkover)
    if (shuffled.length % 2 !== 0) {
      const bye = shuffled[shuffled.length - 1];
      await this.repos.match.create({
          context: "TOURNAMENT",
          status: "WALKOVER",
          winner: "HOME",
          phaseGroup: { connect: { id: groupId } },
          participants: {
            create: [{ player_id: bye.player_id, side: "HOME" }],
          },
      });
    }

    for (const [home, away] of pairs) {
      await this.repos.match.create({
          context: "TOURNAMENT",
          status: "AWAITING_SCHEDULE",
          phaseGroup: { connect: { id: groupId } },
          participants: {
            create: [
              { player_id: home.player_id, side: "HOME" },
              { player_id: away.player_id, side: "AWAY" },
            ],
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // PRIVATE — SEEDING & BRACKET HELPERS
  // ---------------------------------------------------------------------------

  private seedParticipants(participants: any[], seeding: "random" | "by_seed") {
    if (seeding === "by_seed") {
      // Participants with a seed number come first, sorted ascending
      // Unseeded participants are shuffled and appended at the end
      const seeded = participants
        .filter((p) => p.seed !== null && p.seed !== undefined)
        .sort((a, b) => a.seed - b.seed);

      const unseeded = this.shuffle(
        participants.filter((p) => p.seed === null || p.seed === undefined)
      );

      return [...seeded, ...unseeded];
    }

    return this.shuffle([...participants]);
  }

  // Pairs participants for a single elimination bracket
  // 1st vs last, 2nd vs 2nd-to-last, etc.
  private bracketPairs(participants: any[]): [any, any | null][] {
    const pairs: [any, any | null][] = [];
    const list = [...participants];

    while (list.length > 0) {
      const home = list.shift()!;
      const away = list.pop() ?? null;
      pairs.push([home, away]);
    }

    return pairs;
  }

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE — RESOLVE CREATOR
  // ---------------------------------------------------------------------------

  private async resolveCreator(userId: string, tournamentId: string) {
    const player = await this.repos.player.findByUserId(userId);
    if (!player) {
      throw new PhaseError("Player not found", "PLAYER_NOT_FOUND");
    }

    const tournament = await this.repos.tournament.findById(tournamentId);
    if (!tournament || !tournament.is_active) {
      throw new PhaseError("Tournament not found", "TOURNAMENT_NOT_FOUND");
    }

    if (tournament.created_by !== player.id) {
      throw new PhaseError("Not authorized", "UNAUTHORIZED");
    }

    return { player, tournament };
  }
}