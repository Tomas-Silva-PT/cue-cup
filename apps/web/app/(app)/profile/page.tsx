"use client";

import useSWR from "swr";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  User,
  Trophy,
  Swords,
  Users,
  ChevronRight,
  Pencil,
} from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

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
    phase: {
      tournament: { id: string; name: string };
    };
  };
  challenge?: { id: string };
}

interface Team {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface Player {
  id: string;
  nickname: string;
  bio: string | null;
  created_at: string;
  teams: { team: Team; role: string }[];
}

// =============================================================================
// HELPERS
// =============================================================================

const fetcher = (url: string) => api.get<any>(url);

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-4 rounded-lg border bg-card">
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs text-muted-foreground mt-1">{label}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

// =============================================================================
// PROFILE PAGE
// =============================================================================

export default function ProfilePage() {
  const { player: authPlayer } = useAuth();

  const { data: player, isLoading: playerLoading } = useSWR<Player>(
    "/players/me",
    fetcher
  );

  const { data: matches, isLoading: matchesLoading } = useSWR<Match[]>(
    "/matches?status=COMPLETED&limit=20",
    fetcher
  );

  if (playerLoading) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (!player) return null;

  // Calculate stats from match history
  const completedMatches = matches ?? [];
  const wins = completedMatches.filter((m) => {
    const mySide = m.participants.find(
      (p) => p.player.id === authPlayer?.id
    )?.side;
    return m.winner === mySide;
  }).length;
  const losses = completedMatches.length - wins;
  const winRate =
    completedMatches.length > 0
      ? Math.round((wins / completedMatches.length) * 100)
      : 0;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/profile/edit">
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Link>
        </Button>
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
              <h2 className="text-xl font-bold truncate">{player.nickname}</h2>
              {player.bio ? (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {player.bio}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1 italic">
                  No bio yet
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
      {player.teams?.length > 0 && (
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
                const mySide = match.participants.find(
                  (p) => p.player.id === authPlayer?.id
                )?.side;
                const opponent = match.participants.find(
                  (p) => p.player.id !== authPlayer?.id
                );
                const won = match.winner === mySide;
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
    </div>
  );
}
