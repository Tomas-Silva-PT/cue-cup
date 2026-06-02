"use client";

import useSWR from "swr";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Swords,
  Trophy,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// =============================================================================
// TYPES
// =============================================================================

interface Match {
  id: string;
  status: string;
  context: string;
  winner: string | null;
  participants: {
    id: string;
    side: string;
    player: { id: string; nickname: string };
  }[];
  sessions: { id: string; status: string }[];
  scheduleProposals: {
    id: string;
    status: string;
    proposed_time: string;
    location: string | null;
  }[];
  challenge?: { id: string };
  phaseGroup?: {
    id: string;
    phase: {
      id: string;
      name: string;
      tournament: { id: string; name: string };
    };
  };
}

interface Challenge {
  id: string;
  status: string;
  request_note: string | null;
  created_at: string;
  challenger: { id: string; nickname: string };
  challenged: { id: string; nickname: string };
  sport: { id: string; name: string };
}

// =============================================================================
// FETCHERS
// =============================================================================

const fetcher = (url: string) => api.get<any>(url);

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <Skeleton key={i} className="h-20 w-full rounded-lg" />
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: React.ElementType;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
      <Icon className="h-8 w-8 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function MatchStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    ONGOING: { label: "Ongoing", variant: "default" },
    PAUSED: { label: "Paused", variant: "secondary" },
    SCHEDULED: { label: "Scheduled", variant: "outline" },
    AWAITING_SCHEDULE: { label: "Needs schedule", variant: "outline" },
    COMPLETED: { label: "Completed", variant: "secondary" },
  };

  const config = variants[status] ?? { label: status, variant: "outline" };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// =============================================================================
// ACTIVE MATCHES SECTION
// =============================================================================

function ActiveMatches() {
  const { player } = useAuth();
  const { data: matches, isLoading } = useSWR<Match[]>(
    "/matches?status=ONGOING,PAUSED",
    fetcher
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Active Matches
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SectionSkeleton />
        ) : !matches?.length ? (
          <EmptyState icon={Clock} message="No active matches right now" />
        ) : (
          <div className="space-y-2">
            {matches.map((match) => {
              const opponent = match.participants.find(
                (p) => p.player.id !== player?.id
              );
              const mySide = match.participants.find(
                (p) => p.player.id === player?.id
              )?.side;

              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">
                      vs {opponent?.player.nickname ?? "Unknown"}
                    </span>
                    <div className="flex items-center gap-2">
                      <MatchStatusBadge status={match.status} />
                      {match.context === "TOURNAMENT" && match.phaseGroup && (
                        <span className="text-xs text-muted-foreground">
                          {match.phaseGroup.phase.tournament.name}
                        </span>
                      )}
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
  );
}

// =============================================================================
// PENDING CHALLENGES SECTION
// =============================================================================

function PendingChallenges() {
  const { data, isLoading } = useSWR<{ sent: Challenge[]; received: Challenge[] }>(
    "/challenges/mine",
    fetcher
  );

  const pendingReceived = data?.received.filter(
    (c) => c.status === "PENDING"
  ) ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" />
          Pending Challenges
          {pendingReceived.length > 0 && (
            <Badge className="ml-auto">{pendingReceived.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SectionSkeleton />
        ) : !pendingReceived.length ? (
          <EmptyState icon={Swords} message="No pending challenges" />
        ) : (
          <div className="space-y-2">
            {pendingReceived.map((challenge) => (
              <Link
                key={challenge.id}
                href={`/challenges/${challenge.id}`}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">
                    {challenge.challenger.nickname} challenged you
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {challenge.sport.name}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(challenge.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  {challenge.request_note && (
                    <p className="text-xs text-muted-foreground italic">
                      &ldquo;{challenge.request_note}&rdquo;
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        )}
        <div className="mt-3">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/challenges">View all challenges</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// UPCOMING MATCHES SECTION
// =============================================================================

function UpcomingMatches() {
  const { player } = useAuth();
  const { data: matches, isLoading } = useSWR<Match[]>(
    "/matches?status=SCHEDULED",
    fetcher
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Upcoming Matches
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SectionSkeleton />
        ) : !matches?.length ? (
          <EmptyState icon={Calendar} message="No upcoming matches scheduled" />
        ) : (
          <div className="space-y-2">
            {matches.map((match) => {
              const opponent = match.participants.find(
                (p) => p.player.id !== player?.id
              );
              const acceptedProposal = match.scheduleProposals?.find(
                (p) => p.status === "ACCEPTED"
              );

              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">
                      vs {opponent?.player.nickname ?? "Unknown"}
                    </span>
                    {acceptedProposal && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {format(
                            new Date(acceptedProposal.proposed_time),
                            "EEE, MMM d · HH:mm"
                          )}
                        </span>
                        {acceptedProposal.location && (
                          <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">
                              {acceptedProposal.location}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// RECENT RESULTS SECTION
// =============================================================================

function RecentResults() {
  const { player } = useAuth();
  const { data: matches, isLoading } = useSWR<Match[]>(
    "/matches?status=COMPLETED&limit=5",
    fetcher
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          Recent Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SectionSkeleton />
        ) : !matches?.length ? (
          <EmptyState icon={CheckCircle2} message="No completed matches yet" />
        ) : (
          <div className="space-y-2">
            {matches.map((match) => {
              const myParticipant = match.participants.find(
                (p) => p.player.id === player?.id
              );
              const opponent = match.participants.find(
                (p) => p.player.id !== player?.id
              );
              const won = match.winner === myParticipant?.side;

              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-bold w-6 text-center ${
                        won ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {won ? "W" : "L"}
                    </span>
                    <span className="text-sm font-medium">
                      vs {opponent?.player.nickname ?? "Unknown"}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        )}
        <div className="mt-3">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/profile">View full history</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// DASHBOARD PAGE
// =============================================================================

export default function DashboardPage() {
  const { player } = useAuth();

  if (!player) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {player.nickname} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here&apos;s what&apos;s happening with your games
        </p>
      </div>

      {/* Grid layout — 1 col on mobile, 2 cols on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActiveMatches />
        <PendingChallenges />
        <UpcomingMatches />
        <RecentResults />
      </div>
    </div>
  );
}
