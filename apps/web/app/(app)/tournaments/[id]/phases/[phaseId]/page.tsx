"use client";

import { use, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Play, CheckCircle } from "lucide-react";
import { toast } from "sonner";

// =============================================================================
// TYPES
// =============================================================================

interface Player {
  id: string;
  nickname: string;
}

interface MatchParticipant {
  side: string;
  player: Player;
}

interface Match {
  id: string;
  status: string;
  winner: string | null;
  participants: MatchParticipant[];
  sessions?: {
    result: {
      score_home: number;
      score_away: number;
      status: string;
    } | null;
  }[];
}

interface PhaseGroupParticipant {
  final_position: number | null;
  tournament_participant_id: string;
  participant: {
    player: Player;
  };
}

interface PhaseGroup {
  id: string;
  name: string;
  order: number;
  matches: Match[];
  phaseGroupParticipants: PhaseGroupParticipant[];
}

interface Phase {
  id: string;
  name: string;
  order: number;
  type: string;
  status: string;
  config: Record<string, unknown>;
  groups: PhaseGroup[];
  tournament: { id: string; name: string; created_by: string };
}

// =============================================================================
// HELPERS
// =============================================================================

const fetcher = (url: string) => api.get<any>(url);

const PHASE_STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING:   { label: "Pending",   variant: "outline" },
  ONGOING:   { label: "Ongoing",   variant: "default" },
  COMPLETED: { label: "Completed", variant: "secondary" },
  CANCELED:  { label: "Canceled",  variant: "destructive" },
};

// =============================================================================
// STANDINGS TABLE — for ROUND_ROBIN, LEAGUE, SWISS
// =============================================================================

interface Standing {
  player: Player;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

function computeStandings(group: PhaseGroup, config: Record<string, unknown>): Standing[] {
  const pointsWin = (config.pointsWin as number) ?? 3;
  const pointsDraw = (config.pointsDraw as number) ?? 1;
  const pointsLoss = (config.pointsLoss as number) ?? 0;

  const map = new Map<string, Standing>();

  // Initialise all participants
  for (const gp of group.phaseGroupParticipants) {
    map.set(gp.participant.player.id, {
      player: gp.participant.player,
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, points: 0,
    });
  }

  // Accumulate from completed matches
  for (const match of group.matches) {
    if (match.status !== "COMPLETED" && match.status !== "WALKOVER") continue;

    const home = match.participants.find((p) => p.side === "HOME");
    const away = match.participants.find((p) => p.side === "AWAY");
    if (!home || !away) continue;

    const hs = map.get(home.player.id);
    const as_ = map.get(away.player.id);
    if (!hs || !as_) continue;

    hs.played++;
    as_.played++;

    if (match.winner === "HOME") {
      hs.won++; hs.points += pointsWin;
      as_.lost++; as_.points += pointsLoss;
    } else if (match.winner === "AWAY") {
      as_.won++; as_.points += pointsWin;
      hs.lost++; hs.points += pointsLoss;
    } else {
      hs.drawn++; hs.points += pointsDraw;
      as_.drawn++; as_.points += pointsDraw;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.won !== a.won) return b.won - a.won;
    return 0;
  });
}

function StandingsTable({
  group,
  config,
  showPoints,
  advanceTopN,
}: {
  group: PhaseGroup;
  config: Record<string, unknown>;
  showPoints: boolean;
  advanceTopN: number;
}) {
  const standings = computeStandings(group, config);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
            <th className="text-left py-2 w-6">#</th>
            <th className="text-left py-2">Player</th>
            <th className="text-center py-2 w-8">P</th>
            <th className="text-center py-2 w-8">W</th>
            <th className="text-center py-2 w-8">D</th>
            <th className="text-center py-2 w-8">L</th>
            {showPoints && (
              <th className="text-center py-2 w-10 font-bold text-foreground">Pts</th>
            )}
          </tr>
        </thead>
        <tbody>
          {standings.map((s, index) => {
            const advances = index < advanceTopN;
            return (
              <tr
                key={s.player.id}
                className={`border-b last:border-0 ${
                  advances ? "bg-green-500/5" : ""
                }`}
              >
                <td className="py-2.5 text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span>{index + 1}</span>
                    {advances && (
                      <div className="w-1 h-4 bg-green-500 rounded-full" />
                    )}
                  </div>
                </td>
                <td className="py-2.5 font-medium">{s.player.nickname}</td>
                <td className="py-2.5 text-center text-muted-foreground">{s.played}</td>
                <td className="py-2.5 text-center">{s.won}</td>
                <td className="py-2.5 text-center text-muted-foreground">{s.drawn}</td>
                <td className="py-2.5 text-center text-muted-foreground">{s.lost}</td>
                {showPoints && (
                  <td className="py-2.5 text-center font-bold">{s.points}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {advanceTopN > 0 && (
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <span className="w-1 h-3 bg-green-500 rounded-full inline-block" />
          Top {advanceTopN} advance to the next phase
        </p>
      )}
    </div>
  );
}

// =============================================================================
// BRACKET — for SINGLE_ELIMINATION, DOUBLE_ELIMINATION
// =============================================================================

function BracketMatch({ match }: { match: Match }) {
  const home = match.participants.find((p) => p.side === "HOME");
  const away = match.participants.find((p) => p.side === "AWAY");
  const completed = match.status === "COMPLETED" || match.status === "WALKOVER";

  return (
    <Link href={`/matches/${match.id}`}>
      <div className="border rounded-lg overflow-hidden hover:bg-accent transition-colors min-w-[160px]">
        <div
          className={`flex items-center justify-between px-3 py-2 border-b text-sm ${
            completed && match.winner === "HOME"
              ? "bg-green-500/10 font-semibold"
              : completed && match.winner !== "HOME"
              ? "text-muted-foreground"
              : ""
          }`}
        >
          <span className="truncate max-w-[100px]">
            {home?.player.nickname ?? "TBD"}
          </span>
        </div>
        <div
          className={`flex items-center justify-between px-3 py-2 text-sm ${
            completed && match.winner === "AWAY"
              ? "bg-green-500/10 font-semibold"
              : completed && match.winner !== "AWAY"
              ? "text-muted-foreground"
              : ""
          }`}
        >
          <span className="truncate max-w-[100px]">
            {away?.player.nickname ?? "TBD"}
          </span>
        </div>
      </div>
    </Link>
  );
}

function Bracket({ group }: { group: PhaseGroup }) {
  const matches = group.matches;
  if (!matches.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No matches generated yet
      </p>
    );
  }

  // Derive rounds from total matches
  // For N players: round 1 has N/2 matches, round 2 has N/4, etc.
  // Total matches = N - 1 for single elimination
  // We group by deriving round from match index
  const totalMatches = matches.length;
  const rounds: Match[][] = [];

  const remaining = totalMatches;
  let idx = 0;
  let roundSize = Math.pow(2, Math.floor(Math.log2(totalMatches + 1) - 1) + 1) / 2;

  // Fallback: if we can't figure out rounds, show flat list
  if (roundSize < 1) {
    rounds.push(matches);
  } else {
    while (idx < totalMatches) {
      const round = matches.slice(idx, idx + roundSize);
      rounds.push(round);
      idx += roundSize;
      roundSize = Math.ceil(roundSize / 2);
      if (roundSize < 1) break;
    }
  }

  const roundLabels = ["Round of " + (rounds[0]?.length ?? 0) * 2];
  if (rounds.length >= 2) roundLabels.push(...["Semi Final", "Final"].slice(0, rounds.length - 1));
  // Reverse to get correct labels from start
  const labels = [
    ...Array(Math.max(0, rounds.length - 3)).fill("").map((_, i) => `Round ${i + 1}`),
    ...(rounds.length > 2 ? ["Quarter Final"] : []),
    ...(rounds.length > 1 ? ["Semi Final"] : []),
    "Final",
  ].slice(-rounds.length);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-6 min-w-max">
        {rounds.map((round, roundIdx) => (
          <div key={roundIdx} className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide text-center mb-1">
              {labels[roundIdx] ?? `Round ${roundIdx + 1}`}
            </p>
            <div
              className="flex flex-col justify-around gap-4"
              style={{ minHeight: `${round.length * 80}px` }}
            >
              {round.map((match) => (
                <BracketMatch key={match.id} match={match} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// MATCH LIST — shows all matches with results
// =============================================================================

const MATCH_STATUS_LABELS: Record<string, string> = {
  AWAITING_SCHEDULE: "Awaiting schedule",
  SCHEDULED:         "Scheduled",
  ONGOING:           "Ongoing",
  PAUSED:            "Paused",
  AWAITING_RESULT:   "Awaiting result",
  COMPLETED:         "Completed",
  WALKOVER:          "Walkover",
  CANCELED:          "Canceled",
};

function getAggregatedScore(match: Match): { home: number; away: number } | null {
  if (!match.sessions?.length) return null;
  const confirmed = match.sessions.filter(
    (s) => s.result?.status === "CONFIRMED"
  );
  if (!confirmed.length) return null;
  return {
    home: confirmed.reduce((sum, s) => sum + (s.result?.score_home ?? 0), 0),
    away: confirmed.reduce((sum, s) => sum + (s.result?.score_away ?? 0), 0),
  };
}

function MatchList({ matches }: { matches: Match[] }) {
  if (!matches.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No matches yet
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {matches.map((match) => {
        const home = match.participants.find((p) => p.side === "HOME");
        const away = match.participants.find((p) => p.side === "AWAY");
        const completed = match.status === "COMPLETED" || match.status === "WALKOVER";
        const score = getAggregatedScore(match);
        const statusLabel = MATCH_STATUS_LABELS[match.status] ?? match.status;

        return (
          <Link
            key={match.id}
            href={`/matches/${match.id}`}
            className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
          >
            {/* Players */}
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span
                className={`truncate max-w-[100px] ${
                  completed && match.winner === "HOME" ? "font-bold" : ""
                }`}
              >
                {home?.player.nickname ?? "TBD"}
              </span>
              <span className="text-muted-foreground shrink-0">vs</span>
              <span
                className={`truncate max-w-[100px] ${
                  completed && match.winner === "AWAY" ? "font-bold" : ""
                }`}
              >
                {away?.player.nickname ?? "TBD"}
              </span>
            </div>

            {/* Score + status */}
            <div className="flex items-center gap-2 shrink-0">
              {score && (
                <span className="text-sm font-mono font-semibold">
                  {score.home}–{score.away}
                </span>
              )}
              <Badge
                variant={completed ? "secondary" : "outline"}
                className="text-xs"
              >
                {statusLabel}
              </Badge>
            </div>
          </Link>
        );
      })}
    </div>
  );
}


// =============================================================================
// PHASE RULES SUMMARY
// =============================================================================

function PhaseRules({
  type,
  config,
}: {
  type: string;
  config: Record<string, unknown>;
}) {
  const items: { label: string; value: string }[] = [];

  const bestOf = config.bestOf as number | undefined;
  const advanceTopN = config.advanceTopN as number | undefined;
  const groups = config.groups as number | undefined;
  const rounds = config.rounds as number | undefined;
  const thirdPlaceMatch = config.thirdPlaceMatch as boolean | undefined;
  const pointsWin = config.pointsWin as number | undefined;
  const pointsDraw = config.pointsDraw as number | undefined;
  const pointsLoss = config.pointsLoss as number | undefined;
  const seeding = config.seeding as string | undefined;
  const matchGeneration = config.matchGeneration as string | undefined;

  if (bestOf) {
    const winsNeeded = Math.ceil(bestOf / 2);
    items.push({
      label: "Format",
      value: `Best of ${bestOf} (first to ${winsNeeded} wins)`,
    });
  }

  if (groups && groups > 1) {
    items.push({ label: "Groups", value: String(groups) });
  }

  if (advanceTopN) {
    items.push({
      label: "Advancing",
      value: `Top ${advanceTopN} per group`,
    });
  }

  if (rounds) {
    items.push({ label: "Rounds", value: String(rounds) });
  }

  if (type === "LEAGUE" && pointsWin !== undefined) {
    items.push({
      label: "Points",
      value: `Win ${pointsWin} · Draw ${pointsDraw ?? 1} · Loss ${pointsLoss ?? 0}`,
    });
  }

  if (thirdPlaceMatch) {
    items.push({ label: "3rd place match", value: "Yes" });
  }

  if (seeding) {
    items.push({
      label: "Seeding",
      value: seeding === "by_seed" ? "By seed number" : "Random",
    });
  }

  if (matchGeneration) {
    items.push({
      label: "Matches",
      value: matchGeneration === "auto" ? "Auto-generated" : "Manual",
    });
  }

  if (!items.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Rules</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {items.map((item) => (
            <div key={item.label}>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-medium">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// PHASE DETAIL PAGE
// =============================================================================

export default function PhaseDetailPage({
  params,
}: {
  params: Promise<{ id: string; phaseId: string }>;
}) {
  const { id, phaseId } = use(params);
  const { player } = useAuth();
  const [isActing, setIsActing] = useState(false);

  const { data: phase, isLoading, mutate } = useSWR<Phase>(
    `/tournaments/${id}/phases/${phaseId}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (!phase) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-muted-foreground">Phase not found.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href={`/tournaments/${id}`}>Back to tournament</Link>
        </Button>
      </div>
    );
  }

  const isCreator = player?.id === phase.tournament.created_by;
  const statusConfig = PHASE_STATUS_CONFIG[phase.status] ?? {
    label: phase.status,
    variant: "outline" as const,
  };
  const config = phase.config as Record<string, unknown>;
  const advanceTopN = (config.advanceTopN as number) ?? 1;
  const isTableType = ["ROUND_ROBIN", "LEAGUE", "SWISS"].includes(phase.type);
  const isBracketType = ["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION"].includes(phase.type);
  const showPoints = phase.type === "LEAGUE";

  async function handleStart() {
    setIsActing(true);
    try {
      await api.post(`/tournaments/${id}/phases/${phaseId}/start`);
      toast.success("Phase started!");
      mutate();
    } catch (err) {
      toast.error("Failed to start phase", {
        description: err instanceof ApiError ? err.message : "Please try again",
      });
    } finally {
      setIsActing(false);
    }
  }

  async function handleComplete() {
    setIsActing(true);
    try {
      await api.post(`/tournaments/${id}/phases/${phaseId}/complete`);
      toast.success("Phase completed!");
      mutate();
    } catch (err) {
      toast.error("Failed to complete phase", {
        description: err instanceof ApiError ? err.message : "Please try again",
      });
    } finally {
      setIsActing(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/tournaments/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">
            {phase.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            {phase.tournament.name}
          </p>
        </div>
        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
      </div>

      {/* Creator actions */}
      {isCreator && (
        <div className="flex gap-2">
          {phase.status === "PENDING" && (
            <Button size="sm" onClick={handleStart} disabled={isActing}>
              <Play className="h-4 w-4 mr-2" />
              Start Phase
            </Button>
          )}
          {phase.status === "ONGOING" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleComplete}
              disabled={isActing}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Complete Phase
            </Button>
          )}
        </div>
      )}

      {/* Phase rules */}
      <PhaseRules type={phase.type} config={config} />

      {/* Groups */}
      {phase.groups.map((group) => (
        <div key={group.id} className="space-y-4">
          {/* Group header — only show if multiple groups */}
          {phase.groups.length > 1 && (
            <h2 className="text-lg font-semibold">{group.name}</h2>
          )}

          {/* Summary — standings or bracket */}
          {isTableType && group.phaseGroupParticipants.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Standings</CardTitle>
              </CardHeader>
              <CardContent>
                <StandingsTable
                  group={group}
                  config={config}
                  showPoints={showPoints}
                  advanceTopN={advanceTopN}
                />
              </CardContent>
            </Card>
          )}

          {isBracketType && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Bracket</CardTitle>
              </CardHeader>
              <CardContent>
                <Bracket group={group} />
              </CardContent>
            </Card>
          )}

          {/* Match list */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Matches ({group.matches.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MatchList matches={group.matches} />
            </CardContent>
          </Card>
        </div>
      ))}

      {/* Empty state */}
      {phase.groups.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">
              {phase.status === "PENDING"
                ? "Start the phase to generate groups and matches"
                : "No groups found"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
