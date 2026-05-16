import { Prisma } from "./prisma";
import bcrypt from "bcryptjs";

// =============================================================================
// HELPERS
// =============================================================================

function slug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

// =============================================================================
// SEED
// =============================================================================

async function main() {
  console.log("🌱 Starting seed...");

  // ---------------------------------------------------------------------------
  // SPORT
  // ---------------------------------------------------------------------------

  const pool8ball = await Prisma.sport.upsert({
    where: { slug: "pool-8ball" },
    update: {},
    create: {
      name: "Pool 8-ball",
      slug: "pool-8ball",
      description: "Standard 8-ball pool played with 15 balls and a cue ball.",
      rules: {
        playersPerSide: 1,
        scoringUnit: "frames",
        allowDraws: false,
        defaultBestOf: 1,
        winCondition: "frames",
        maxScorePerUnit: null,
        tiebreakerRules: ["sudden_death"],
        rules: {
          ballInHand: false,
          sacaBola: true,
          callPocket: false,
        },
      },
      is_active: true,
    },
  });

  console.log(`✅ Sport: ${pool8ball.name}`);

  // ---------------------------------------------------------------------------
  // USERS + PLAYERS
  // ---------------------------------------------------------------------------

  const playersData = [
    { name: "João Silva", nickname: "jsilva", email: "joao@cue.cup" },
    { name: "Pedro Costa", nickname: "pcosta", email: "pedro@cue.cup" },
    { name: "Ana Ferreira", nickname: "aferreira", email: "ana@cue.cup" },
    { name: "Rui Santos", nickname: "rsantos", email: "rui@cue.cup" },
    { name: "Sofia Lopes", nickname: "slopes", email: "sofia@cue.cup" },
    { name: "Marta Nunes", nickname: "mnunes", email: "marta@cue.cup" },
    { name: "Carlos Dias", nickname: "cdias", email: "carlos@cue.cup" },
    { name: "Tiago Rocha", nickname: "trocha", email: "tiago@cue.cup" },
    { name: "Inês Pinto", nickname: "ipinto", email: "ines@cue.cup" },
    { name: "Bruno Melo", nickname: "bmelo", email: "bruno@cue.cup" },
    { name: "Catarina Luz", nickname: "cluz", email: "catarina@cue.cup" },
    { name: "Diogo Faria", nickname: "dfaria", email: "diogo@cue.cup" },
  ];

  const passwordHash = await hashPassword("password123");

  const players = [];

  for (const data of playersData) {
    const user = await Prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        email: data.email,
        password_hash: passwordHash,
        name: data.name,
        role: "USER",
        player: {
          create: {
            nickname: data.nickname,
            bio: `Hi, I'm ${data.name.split(" ")[0]}. Let's play!`,
          },
        },
      },
      include: { player: true },
    });

    players.push(user.player!);
    console.log(`✅ Player: ${data.nickname}`);
  }

  const [joao, pedro, ana, rui, sofia, marta, carlos, tiago, ines, bruno, catarina, diogo] = players;

  // ---------------------------------------------------------------------------
  // TEAMS
  // ---------------------------------------------------------------------------

  const teamAlpha = await Prisma.team.upsert({
    where: { slug: "team-alpha" },
    update: {},
    create: {
      name: "Team Alpha",
      slug: "team-alpha",
      description: "The Alpha squad.",
      created_by: joao.id,
      members: {
        create: [
          { player_id: joao.id, role: "OWNER" },
          { player_id: pedro.id, role: "MEMBER" },
          { player_id: ana.id, role: "MEMBER" },
          { player_id: rui.id, role: "MEMBER" },
          { player_id: sofia.id, role: "MEMBER" },
          { player_id: marta.id, role: "MEMBER" },
        ],
      },
    },
  });

  const teamBeta = await Prisma.team.upsert({
    where: { slug: "team-beta" },
    update: {},
    create: {
      name: "Team Beta",
      slug: "team-beta",
      description: "The Beta squad.",
      created_by: carlos.id,
      members: {
        create: [
          { player_id: carlos.id, role: "OWNER" },
          { player_id: tiago.id, role: "MEMBER" },
          { player_id: ines.id, role: "MEMBER" },
          { player_id: bruno.id, role: "MEMBER" },
          { player_id: catarina.id, role: "MEMBER" },
          { player_id: diogo.id, role: "MEMBER" },
        ],
      },
    },
  });

  console.log(`✅ Team: ${teamAlpha.name}`);
  console.log(`✅ Team: ${teamBeta.name}`);

  // ---------------------------------------------------------------------------
  // TOURNAMENT
  // ---------------------------------------------------------------------------

  const tournament = await Prisma.tournament.upsert({
    where: { slug: "campeonato-verao-2025" },
    update: {},
    create: {
      name: "Campeonato de Verão 2025",
      slug: "campeonato-verao-2025",
      description: "Torneio anual de verão entre amigos.",
      sport_id: pool8ball.id,
      created_by: joao.id,
      status: "ONGOING",
      visibility: "PRIVATE",
      min_players: 8,
      max_players: 12,
      teamBased: true,
      invitation_code: "VERAO25",
    },
  });

  console.log(`✅ Tournament: ${tournament.name}`);

  // ---------------------------------------------------------------------------
  // TOURNAMENT PARTICIPANTS
  // ---------------------------------------------------------------------------

  const participantData = [
    joao, pedro, ana, rui, sofia, marta,
    carlos, tiago, ines, bruno, catarina, diogo,
  ];

  const participants = [];

  for (const player of participantData) {
    const existing = await Prisma.tournamentParticipant.findUnique({
      where: {
        tournament_id_player_id: {
          tournament_id: tournament.id,
          player_id: player.id,
        },
      },
    });

    const participant = existing ?? await Prisma.tournamentParticipant.create({
      data: {
        tournament_id: tournament.id,
        player_id: player.id,
        status: "ACCEPTED",
      },
    });

    participants.push(participant);
  }

  const [pJoao, pPedro, pAna, pRui, pSofia, pMarta, pCarlos, pTiago, pInes, pBruno, pCatarina, pDiogo] = participants;

  console.log(`✅ ${participants.length} tournament participants`);

  // ---------------------------------------------------------------------------
  // PHASE 1 — GRUPOS (ROUND ROBIN)
  // ---------------------------------------------------------------------------

  const phase1 = await Prisma.phase.upsert({
    where: { id: "phase-grupos-seed" },
    update: {},
    create: {
      id: "phase-grupos-seed",
      tournament_id: tournament.id,
      name: "Fase de Grupos",
      order: 1,
      type: "ROUND_ROBIN",
      status: "COMPLETED",
      config: {
        advanceTopN: 2,
        tiebreak: ["wins", "frame_diff", "head_to_head"],
      },
      started_at: new Date("2025-07-01"),
      completed_at: new Date("2025-07-15"),
    },
  });

  // Grupo A — Team Alpha
  const groupA = await Prisma.phaseGroup.upsert({
    where: { id: "group-a-seed" },
    update: {},
    create: {
      id: "group-a-seed",
      phase_id: phase1.id,
      name: "Grupo A",
      order: 1,
    },
  });

  // Grupo B — Team Beta
  const groupB = await Prisma.phaseGroup.upsert({
    where: { id: "group-b-seed" },
    update: {},
    create: {
      id: "group-b-seed",
      phase_id: phase1.id,
      name: "Grupo B",
      order: 2,
    },
  });

  // Add participants to groups
  const groupAParticipants = [pJoao, pPedro, pAna, pRui, pSofia, pMarta];
  const groupBParticipants = [pCarlos, pTiago, pInes, pBruno, pCatarina, pDiogo];

  for (const p of groupAParticipants) {
    await Prisma.phaseGroupParticipant.upsert({
      where: {
        phase_group_id_tournament_participant_id: {
          phase_group_id: groupA.id,
          tournament_participant_id: p.id,
        },
      },
      update: {},
      create: {
        phase_group_id: groupA.id,
        tournament_participant_id: p.id,
      },
    });
  }

  for (const p of groupBParticipants) {
    await Prisma.phaseGroupParticipant.upsert({
      where: {
        phase_group_id_tournament_participant_id: {
          phase_group_id: groupB.id,
          tournament_participant_id: p.id,
        },
      },
      update: {},
      create: {
        phase_group_id: groupB.id,
        tournament_participant_id: p.id,
      },
    });
  }

  console.log(`✅ Phase 1: Fase de Grupos (Grupo A + Grupo B)`);

  // ---------------------------------------------------------------------------
  // PHASE 2 — ELIMINATÓRIAS (SINGLE ELIMINATION)
  // ---------------------------------------------------------------------------

  const phase2 = await Prisma.phase.upsert({
    where: { id: "phase-elim-seed" },
    update: {},
    create: {
      id: "phase-elim-seed",
      tournament_id: tournament.id,
      name: "Eliminatórias",
      order: 2,
      type: "SINGLE_ELIMINATION",
      status: "ONGOING",
      config: {
        bestOf: 5,
        seeded: true,
        thirdPlaceMatch: true,
      },
      started_at: new Date("2025-07-20"),
    },
  });

  const bracket = await Prisma.phaseGroup.upsert({
    where: { id: "bracket-seed" },
    update: {},
    create: {
      id: "bracket-seed",
      phase_id: phase2.id,
      name: "Bracket",
      order: 1,
    },
  });

  // Top 2 from each group advance (João, Pedro from A; Carlos, Tiago from B)
  const advancedParticipants = [pJoao, pPedro, pCarlos, pTiago];

  for (const [i, p] of advancedParticipants.entries()) {
    await Prisma.phaseGroupParticipant.upsert({
      where: {
        phase_group_id_tournament_participant_id: {
          phase_group_id: bracket.id,
          tournament_participant_id: p.id,
        },
      },
      update: {},
      create: {
        phase_group_id: bracket.id,
        tournament_participant_id: p.id,
        final_position: null,
      },
    });
  }

  console.log(`✅ Phase 2: Eliminatórias (bracket)`);

  // ---------------------------------------------------------------------------
  // MATCHES — Grupo A (completed, with sessions and results)
  // ---------------------------------------------------------------------------

  async function createCompletedMatch(
    groupId: string,
    homeParticipantId: string,
    awayParticipantId: string,
    homeScore: number,
    awayScore: number,
  ) {
    try {
      const homePart = await Prisma.tournamentParticipant.findUniqueOrThrow({ where: { id: homeParticipantId } });
      const awayPart = await Prisma.tournamentParticipant.findUniqueOrThrow({ where: { id: awayParticipantId } });

      const match = await Prisma.match.create({
        data: {
          context: "TOURNAMENT",
          phase_group_id: groupId,
          status: "COMPLETED",
          winner: homeScore > awayScore ? "HOME" : "AWAY",
          participants: {
            create: [
              { player_id: homePart.player_id, side: "HOME" },
              { player_id: awayPart.player_id, side: "AWAY" },
            ],
          },
        },
      });

      const session = await Prisma.session.create({
        data: {
          match_id: match.id,
          number: 1,
          status: "COMPLETED",
          started_at: new Date("2025-07-05"),
          ended_at: new Date("2025-07-05"),
        },
      });

      await Prisma.result.create({
        data: {
          session_id: session.id,
          score_home: homeScore,
          score_away: awayScore,
          status: "CONFIRMED",
          proposed_by: homePart.player_id,
          confirmedBy: awayPart.player_id,
          confirmation_method: "MUTUAL_AGREEMENT",
          confirmed_at: new Date("2025-07-05"),
          history: [],
        },
      });

      return match;
    } catch (e: any) {
      // Skip if already exists on repeated seed runs
      if (e.code === "P2002") return;
      throw e;
    }
  }

  // Grupo A matches
  await createCompletedMatch(groupA.id, pJoao.id, pPedro.id, 2, 1, 1);
  await createCompletedMatch(groupA.id, pAna.id, pRui.id, 1, 2, 2);
  await createCompletedMatch(groupA.id, pSofia.id, pMarta.id, 2, 0, 3);
  await createCompletedMatch(groupA.id, pJoao.id, pAna.id, 2, 0, 4);
  await createCompletedMatch(groupA.id, pPedro.id, pRui.id, 1, 2, 5);

  console.log(`✅ Grupo A matches`);

  // ---------------------------------------------------------------------------
  // MATCH — Eliminatórias (ongoing, multi-session)
  // ---------------------------------------------------------------------------

  const semiFinal = await Prisma.match.upsert({
  where: { id: "match-semi-seed" },
  update: {},
  create: {
    id: "match-semi-seed",
    context: "TOURNAMENT",
    status: "PAUSED",
    phaseGroup: {
      connect: { id: bracket.id },
    },
    participants: {
      create: [
        { player_id: joao.id,   side: "HOME" },
        { player_id: carlos.id, side: "AWAY" },
      ],
    },
  },
});

  // Session 1 — completed
  const semiFinalSession1 = await Prisma.session.upsert({
    where: { id: "session-semi-1-seed" },
    update: {},
    create: {
      id: "session-semi-1-seed",
      match_id: semiFinal.id,
      number: 1,
      status: "COMPLETED",
      location: "Mesa 3",
      started_at: new Date("2025-07-21T19:00:00"),
      ended_at: new Date("2025-07-21T22:00:00"),
    },
  });

  await Prisma.result.upsert({
    where: { session_id: semiFinalSession1.id },
    update: {},
    create: {
      session_id: semiFinalSession1.id,
      score_home: 2,
      score_away: 1,
      status: "CONFIRMED",
      proposed_by: joao.id,
      confirmedBy: carlos.id,
      confirmation_method: "MUTUAL_AGREEMENT",
      confirmed_at: new Date("2025-07-21T22:05:00"),
      history: [],
    },
  });

  // Session 2 — in progress, result proposed but not confirmed yet
  const semiFinalSession2 = await Prisma.session.upsert({
    where: { id: "session-semi-2-seed" },
    update: {},
    create: {
      id: "session-semi-2-seed",
      match_id: semiFinal.id,
      number: 2,
      status: "IN_PROGRESS",
      location: "Mesa 3",
      started_at: new Date("2025-07-22T19:00:00"),
    },
  });

  await Prisma.result.upsert({
    where: { session_id: semiFinalSession2.id },
    update: {},
    create: {
      session_id: semiFinalSession2.id,
      score_home: 1,
      score_away: 1,
      status: "PROPOSED",
      proposed_by: joao.id,
      confirmation_method: "MUTUAL_AGREEMENT",
      history: [],
    },
  });

  console.log(`✅ Semi-final match (paused, 2 sessions)`);

  // ---------------------------------------------------------------------------
  // CHALLENGES
  // ---------------------------------------------------------------------------

  // Challenge 1 — pending (Sofia challenged Marta)
  await Prisma.challenge.upsert({
    where: { id: "challenge-1-seed" },
    update: {},
    create: {
      id: "challenge-1-seed",
      challenger_id: sofia.id,
      challenged_id: marta.id,
      sport_id: pool8ball.id,
      status: "PENDING",
      request_note: "Vamos a isso? Melhor de 3.",
      config: { bestOf: 3, rules: { ballInHand: true } },
    },
  });

  // Challenge 2 — accepted with an ongoing match
  const challenge2 = await Prisma.challenge.upsert({
    where: { id: "challenge-2-seed" },
    update: {},
    create: {
      id: "challenge-2-seed",
      challenger_id: bruno.id,
      challenged_id: diogo.id,
      sport_id: pool8ball.id,
      status: "ACCEPTED",
      request_note: "Desafio aberto!",
      response_note: "Aceite, combinamos horário.",
      responded_at: new Date("2025-07-10"),
      config: { bestOf: 1 },
    },
  });

  const challengeMatch = await Prisma.match.upsert({
    where: { id: "match-challenge-seed" },
    update: {},
    create: {
      id: "match-challenge-seed",
      context: "CHALLENGE",
      challenge_id: challenge2.id,
      status: "AWAITING_SCHEDULE",
      participants: {
        create: [
          { player_id: bruno.id, side: "HOME" },
          { player_id: diogo.id, side: "AWAY" },
        ],
      },
    },
  });

  // Schedule proposal for the challenge match
  await Prisma.scheduleProposal.upsert({
    where: { id: "schedule-1-seed" },
    update: {},
    create: {
      id: "schedule-1-seed",
      match_id: challengeMatch.id,
      proposed_by: bruno.id,
      proposed_time: new Date("2025-07-25T20:00:00"),
      location: "Mesa 1",
      note: "Sexta às 20h, dá-te?",
      status: "PENDING",
    },
  });

  // Challenge 3 — completed with a match
  const challenge3 = await Prisma.challenge.upsert({
    where: { id: "challenge-3-seed" },
    update: {},
    create: {
      id: "challenge-3-seed",
      challenger_id: ines.id,
      challenged_id: catarina.id,
      sport_id: pool8ball.id,
      status: "COMPLETED",
      responded_at: new Date("2025-07-08"),
      config: { bestOf: 1 },
    },
  });

  const challengeMatch3 = await Prisma.match.upsert({
    where: { id: "match-challenge-3-seed" },
    update: {},
    create: {
      id: "match-challenge-3-seed",
      context: "CHALLENGE",
      challenge_id: challenge3.id,
      status: "COMPLETED",
      winner: "HOME",
      participants: {
        create: [
          { player_id: ines.id, side: "HOME" },
          { player_id: catarina.id, side: "AWAY" },
        ],
      },
    },
  });

  const challengeSession3 = await Prisma.session.upsert({
    where: { id: "session-challenge-3-seed" },
    update: {},
    create: {
      id: "session-challenge-3-seed",
      match_id: challengeMatch3.id,
      number: 1,
      status: "COMPLETED",
      started_at: new Date("2025-07-12T18:00:00"),
      ended_at: new Date("2025-07-12T19:30:00"),
    },
  });

  await Prisma.result.upsert({
    where: { session_id: challengeSession3.id },
    update: {},
    create: {
      session_id: challengeSession3.id,
      score_home: 1,
      score_away: 0,
      status: "CONFIRMED",
      proposed_by: ines.id,
      confirmedBy: catarina.id,
      confirmation_method: "MUTUAL_AGREEMENT",
      confirmed_at: new Date("2025-07-12T19:35:00"),
      history: [],
    },
  });

  console.log(`✅ 3 challenges (pending, accepted with schedule, completed)`);

  console.log("\n🎱 Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await Prisma.$disconnect();
  });
