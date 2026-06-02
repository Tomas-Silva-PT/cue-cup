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
import { ArrowLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// =============================================================================
// TYPES
// =============================================================================

interface Match {
  id: string;
  status: string;
  winner: string | null;
  participants: {
    side: string;
    player: { id: string; nickname: string };
  }[];
}

interface Challenge {
  id: string;
  status: string;
  request_note: string | null;
  response_note: string | null;
  created_at: string;
  responded_at: string | null;
  challenger: { id: string; nickname: string };
  challenged: { id: string; nickname: string };
  sport: { id: string; name: string };
  matches: Match[];
}

// =============================================================================
// CHALLENGE DETAIL PAGE
// =============================================================================

const fetcher = (url: string) => api.get<any>(url);

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING:   { label: "Pending",   variant: "default" },
  ACCEPTED:  { label: "Accepted",  variant: "secondary" },
  REJECTED:  { label: "Rejected",  variant: "destructive" },
  WITHDRAWN: { label: "Withdrawn", variant: "outline" },
  COMPLETED: { label: "Completed", variant: "secondary" },
  CANCELED:  { label: "Canceled",  variant: "outline" },
};

export default function ChallengeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { player } = useAuth();
  const { data: challenge, isLoading } = useSWR<Challenge>(
    `/challenges/${params.id}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <p className="text-muted-foreground">Challenge not found.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/challenges">Back to challenges</Link>
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[challenge.status] ?? {
    label: challenge.status,
    variant: "outline" as const,
  };

  const isChallenger = player?.id === challenge.challenger.id;
  const opponent = isChallenger ? challenge.challenged : challenge.challenger;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/challenges">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">
            vs {opponent.nickname}
          </h1>
          <p className="text-muted-foreground text-sm">
            {challenge.sport.name} ·{" "}
            {formatDistanceToNow(new Date(challenge.created_at), {
              addSuffix: true,
            })}
          </p>
        </div>
        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
      </div>

      {/* Challenge details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Challenger</span>
            <span className="font-medium">{challenge.challenger.nickname}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Challenged</span>
            <span className="font-medium">{challenge.challenged.nickname}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Sport</span>
            <span className="font-medium">{challenge.sport.name}</span>
          </div>
          {challenge.request_note && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Message</p>
              <p className="text-sm italic">
                &ldquo;{challenge.request_note}&rdquo;
              </p>
            </div>
          )}
          {challenge.response_note && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Response</p>
              <p className="text-sm italic">
                &ldquo;{challenge.response_note}&rdquo;
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Matches */}
      {challenge.matches.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Matches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {challenge.matches.map((match, index) => {
              const myParticipant = match.participants.find(
                (p) => p.player.id === player?.id
              );
              const won =
                match.status === "COMPLETED" &&
                match.winner === myParticipant?.side;

              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {match.status === "COMPLETED" && (
                      <span
                        className={`text-xs font-bold w-5 ${
                          won ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {won ? "W" : "L"}
                      </span>
                    )}
                    <span className="text-sm font-medium">
                      Match {index + 1}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {match.status}
                    </Badge>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
