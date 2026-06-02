"use client";

import useSWR from "swr";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Swords, Users, ChevronRight } from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

interface Player {
  id: string;
  nickname: string;
  bio: string | null;
  created_at: string;
  teams: { team: { id: string; name: string }; role: string }[];
}

interface Match {
  id: string;
  status: string;
  winner: string | null;
  context: string;
  participants: {
    side: string;
    player: { id: string; nickname: string };
  }[];
  phaseGroup?: {
    phase: { tournament: { id: string; name: string } };
  };
}

// =============================================================================
// HELPERS
// =============================================================================

const fetcher = (url: string) => api.get<any>(url);

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center justify-center p-4 rounded-lg border bg-card">
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs text-muted-foreground mt-1">{label}</span>
    </div>
  );
}

// =============================================================================
// PUBLIC PLAYER PROFILE PAGE
// =============================================================================

export default function PlayerProfilePage({
  params,
}: {
  params: { nickname: string };
}) {
  const { player: authPlayer } = useAuth();

  const { data: player, isLoading } = useSWR<Player>(
    `/players/nickname/${params.nickname}`,
    fetcher
  );

  const { data: matches, isLoading: matchesLoading } = useSWR<Match[]>(
    player ? `/players/${player.id}/matches` : null,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <p className="text-muted-foreground">Player not found.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  // Redirect to own profile if viewing yourself
  const isOwnProfile = authPlayer?.id === player.id;

  const completedMatches = matches?.filter((m) => m.status === "COMPLETED") ?? [];
  const wins = completedMatches.filter((m) => {
    const side = m.participants.find((p) => p.player.id === player.id)?.side;
    return m.winner === side;
  }).length;
  const losses = completedMatches.length - wins;
  const winRate =
    completedMatches.length > 0
      ? Math.round((wins / completedMatches.length) * 100)
      : 0;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => history.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{player.nickname}</h1>
        {isOwnProfile && (
          <Badge variant="outline" className="ml-auto">You</Badge>
        )}
      </div>

      {/* Player info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-primary">
                {player.nickname[0]?.toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold">{player.nickname}</h2>
              {player.bio ? (
                <p className="text-sm text-muted-foreground mt-1">
                  {player.bio}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1 italic">
                  No bio
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div>
        <h2 className="text-base font-semibold mb-3">Stats</h2>
        {matchesLoading ? (
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            <StatCard label="Played" value={completedMatches.length} />
            <StatCard label="Won" value={wins} />
            <StatCard label="Lost" value={losses} />
            <StatCard label="Win Rate" value={`${winRate}%`} />
          </div>
        )}
      </div>

      {/* Teams */}
      {player.teams.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Teams
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {player.teams.map(({ team, role }) => (
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {team.name[0]?.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium">{team.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs capitalize">
                    {role.toLowerCase()}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Match history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Swords className="h-4 w-4" />
            Match History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {matchesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : !completedMatches.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No completed matches yet
            </p>
          ) : (
            <div className="space-y-2">
              {completedMatches.map((match) => {
                const side = match.participants.find(
                  (p) => p.player.id === player.id
                )?.side;
                const opponent = match.participants.find(
                  (p) => p.player.id !== player.id
                );
                const won = match.winner === side;
                const context =
                  match.context === "TOURNAMENT" && match.phaseGroup
                    ? match.phaseGroup.phase.tournament.name
                    : "Challenge";

                return (
                  <Link
                    key={match.id}
                    href={`/matches/${match.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-bold w-5 shrink-0 ${
                          won ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {won ? "W" : "L"}
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          vs {opponent?.player.nickname ?? "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {context}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Challenge button — only show if viewing someone else */}
      {!isOwnProfile && (
        <Button className="w-full" asChild>
          <Link href={`/challenges/new?nickname=${player.nickname}`}>
            Challenge {player.nickname}
          </Link>
        </Button>
      )}
    </div>
  );
}
