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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCw,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// =============================================================================
// TYPES
// =============================================================================

interface Result {
  id: string;
  score_home: number;
  score_away: number;
  status: string;
  proposed_by: string;
  confirmed_at: string | null;
}

interface Session {
  id: string;
  number: number;
  status: string;
  location: string | null;
  started_at: string;
  ended_at: string | null;
  result: Result | null;
}

interface ScheduleProposal {
  id: string;
  status: string;
  proposed_time: string;
  location: string | null;
  note: string | null;
  proposed_by: string;
}

interface Match {
  id: string;
  status: string;
  context: string;
  winner: string | null;
  participants: {
    side: string;
    player: { id: string; nickname: string };
  }[];
  sessions: Session[];
  scheduleProposals: ScheduleProposal[];
  phaseGroup?: {
    id: string;
    name: string;
    phase: {
      id: string;
      name: string;
      tournament: { id: string; name: string };
    };
  };
  challenge?: { id: string };
}

// =============================================================================
// HELPERS
// =============================================================================

const fetcher = (url: string) => api.get<any>(url);

const MATCH_STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  AWAITING_SCHEDULE: { label: "Awaiting Schedule", variant: "outline" },
  SCHEDULED: { label: "Scheduled", variant: "outline" },
  ONGOING: { label: "Ongoing", variant: "default" },
  PAUSED: { label: "Paused", variant: "secondary" },
  AWAITING_RESULT: { label: "Awaiting Result", variant: "outline" },
  COMPLETED: { label: "Completed", variant: "secondary" },
  WALKOVER: { label: "Walkover", variant: "secondary" },
  CANCELED: { label: "Canceled", variant: "destructive" },
};

const RESULT_STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  PROPOSED: { label: "Proposed", variant: "outline" },
  CONFIRMED: { label: "Confirmed", variant: "secondary" },
  DISPUTED: { label: "Disputed", variant: "destructive" },
  REJECTED: { label: "Rejected", variant: "destructive" },
};

// =============================================================================
// PROPOSE RESULT FORM
// =============================================================================

function ProposeResultForm({
  sessionId,
  onSuccess,
}: {
  sessionId: string;
  onSuccess: () => void;
}) {
  const [scoreHome, setScoreHome] = useState(0);
  const [scoreAway, setScoreAway] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post(`/sessions/${sessionId}/result`, {
        scoreHome,
        scoreAway,
      });
      toast.success("Result proposed!");
      onSuccess();
    } catch (err) {
      toast("Failed to propose result", {
        description: err instanceof ApiError ? err.message : "Please try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Home score</Label>
          <Input
            type="number"
            min={0}
            value={scoreHome}
            onChange={(e) => setScoreHome(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Away score</Label>
          <Input
            type="number"
            min={0}
            value={scoreAway}
            onChange={(e) => setScoreAway(Number(e.target.value))}
          />
        </div>
      </div>
      <Button
        type="submit"
        size="sm"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Proposing..." : "Propose Result"}
      </Button>
    </form>
  );
}

// =============================================================================
// MATCH DETAIL PAGE
// =============================================================================

export default function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  {
    const { player } = useAuth();
    const [isActing, setIsActing] = useState(false);

    const {
      data: match,
      isLoading,
      mutate,
    } = useSWR<Match>(`/matches/${id}`, fetcher);

    if (isLoading) {
      return (
        <div className="max-w-lg mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      );
    }

    if (!match) {
      return (
        <div className="max-w-lg mx-auto text-center py-16">
          <p className="text-muted-foreground">Match not found.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      );
    }

    const isParticipant = match.participants.some(
      (p) => p.player.id === player?.id,
    );
    const mySide = match.participants.find(
      (p) => p.player.id === player?.id,
    )?.side;
    const homePlayer = match.participants.find((p) => p.side === "HOME");
    const awayPlayer = match.participants.find((p) => p.side === "AWAY");
    const activeSession = match.sessions.find(
      (s) => s.status === "IN_PROGRESS",
    );
    const statusConfig = MATCH_STATUS_CONFIG[match.status] ?? {
      label: match.status,
      variant: "outline" as const,
    };

    async function handleAction(
      action: "start" | "pause" | "resume" | "complete" | "walkover",
    ) {
      setIsActing(true);
      try {
        await api.post(`/matches/${id}/${action}`);
        toast.success(`Match ${action}ed!`);
        mutate();
      } catch (err) {
        console.log("Complete match error:", err, err instanceof ApiError);
        toast.error(`Failed to ${action} match`, {
          description:
            err instanceof ApiError ? err.message : "Please try again",
        });
      } finally {
        setIsActing(false);
      }
    }

    async function handleResultAction(
      sessionId: string,
      action: "confirm" | "dispute",
    ) {
      setIsActing(true);
      try {
        await api.post(`/sessions/${sessionId}/result/${action}`);
        toast.success(
          action === "confirm" ? "Result confirmed!" : "Result disputed",
        );
        mutate();
      } catch (err) {
        toast.error(`Failed to ${action} result`, {
          description:
            err instanceof ApiError ? err.message : "Please try again",
        });
      } finally {
        setIsActing(false);
      }
    }

    // Calculate cumulative score from confirmed sessions
    const confirmedSessions = match.sessions.filter(
      (s) => s.result?.status === "CONFIRMED",
    );
    const totalHomeScore = confirmedSessions.reduce(
      (sum, s) => sum + (s.result?.score_home ?? 0),
      0,
    );
    const totalAwayScore = confirmedSessions.reduce(
      (sum, s) => sum + (s.result?.score_away ?? 0),
      0,
    );

    return (
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => history.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">
              {homePlayer?.player.nickname ?? "TBD"} vs{" "}
              {awayPlayer?.player.nickname ?? "TBD"}
            </h1>
            {match.phaseGroup && (
              <Link
                href={`/tournaments/${match.phaseGroup.phase.tournament.id}/phases/${match.phaseGroup.phase.id}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {match.phaseGroup.phase.tournament.name} ·{" "}
                {match.phaseGroup.phase.name} · {match.phaseGroup.name}
              </Link>
            )}
            {match.challenge && (
              <Link
                href={`/challenges/${match.challenge.id}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Challenge match
              </Link>
            )}
          </div>
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </div>

        {/* Score */}
        {match.sessions.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">
                    {homePlayer?.player.nickname}
                    {mySide === "HOME" && (
                      <span className="text-xs text-primary ml-1">(you)</span>
                    )}
                  </p>
                  <p className="text-5xl font-bold">{totalHomeScore}</p>
                </div>
                <div className="text-2xl text-muted-foreground font-light">
                  —
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">
                    {awayPlayer?.player.nickname}
                    {mySide === "AWAY" && (
                      <span className="text-xs text-primary ml-1">(you)</span>
                    )}
                  </p>
                  <p className="text-5xl font-bold">{totalAwayScore}</p>
                </div>
              </div>
              {match.status === "COMPLETED" && match.winner && (
                <p className="text-center text-sm font-medium mt-4">
                  {match.winner === mySide
                    ? "🎉 You won!"
                    : "Better luck next time"}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Participant actions */}
        {isParticipant && (
          <div className="flex gap-2">
            {(match.status === "AWAITING_SCHEDULE" ||
              match.status === "SCHEDULED") && (
              <Button
                size="sm"
                onClick={() => handleAction("start")}
                disabled={isActing}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Match
              </Button>
            )}
            {match.status === "ONGOING" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction("pause")}
                  disabled={isActing}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAction("complete")}
                  disabled={isActing}
                >
                  Complete Match
                </Button>
              </>
            )}
            {match.status === "PAUSED" && (
              <Button
                size="sm"
                onClick={() => handleAction("resume")}
                disabled={isActing}
              >
                <RotateCw className="h-4 w-4 mr-2" />
                Resume
              </Button>
            )}

            {/* Forfeit — participant concedes */}
            {match.status !== "COMPLETED" &&
              match.status !== "WALKOVER" &&
              match.status !== "CANCELED" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive ml-auto"
                      disabled={isActing}
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      Forfeit
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Forfeit match?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You will concede this match.{" "}
                        {mySide === "HOME"
                          ? awayPlayer?.player.nickname
                          : homePlayer?.player.nickname}{" "}
                        will be awarded the win. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90"
                        onClick={() => handleAction("walkover")}
                      >
                        Forfeit match
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
          </div>
        )}

        {/* Schedule proposals */}
        {match.scheduleProposals.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {match.scheduleProposals.map((proposal) => (
                <div
                  key={proposal.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {format(
                        new Date(proposal.proposed_time),
                        "EEE, MMM d · HH:mm",
                      )}
                    </p>
                    {proposal.location && (
                      <p className="text-xs text-muted-foreground">
                        {proposal.location}
                      </p>
                    )}
                    {proposal.note && (
                      <p className="text-xs text-muted-foreground italic">
                        &ldquo;{proposal.note}&rdquo;
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {proposal.status}
                  </Badge>
                </div>
              ))}
              {isParticipant &&
                match.status !== "COMPLETED" &&
                match.status !== "CANCELED" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    asChild
                  >
                    <Link href={`/matches/${match.id}/schedule`}>
                      Propose Schedule
                    </Link>
                  </Button>
                )}
            </CardContent>
          </Card>
        )}

        {/* Sessions */}
        {match.sessions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {match.sessions.map((session) => {
                const resultConfig = session.result
                  ? RESULT_STATUS_CONFIG[session.result.status]
                  : null;
                const canConfirm =
                  isParticipant &&
                  session.result?.status === "PROPOSED" &&
                  session.result.proposed_by !== player?.id;
                const canDispute =
                  isParticipant &&
                  session.result?.status === "PROPOSED" &&
                  session.result.proposed_by !== player?.id;
                const canPropose =
                  isParticipant &&
                  (!session.result ||
                    session.result.status === "DISPUTED" ||
                    session.result.status === "REJECTED");

                return (
                  <div
                    key={session.id}
                    className="p-3 rounded-lg border space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Session {session.number}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {session.status}
                      </Badge>
                    </div>

                    {/* Result */}
                    {session.result && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          {session.result.score_home} —{" "}
                          {session.result.score_away}
                        </span>
                        {resultConfig && (
                          <Badge
                            variant={resultConfig.variant}
                            className="text-xs"
                          >
                            {resultConfig.label}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Result actions */}
                    {canConfirm && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={isActing}
                          onClick={() =>
                            handleResultAction(session.id, "confirm")
                          }
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={isActing}
                          onClick={() =>
                            handleResultAction(session.id, "dispute")
                          }
                        >
                          Dispute
                        </Button>
                      </div>
                    )}

                    {/* Propose result */}
                    {canPropose && (
                      <ProposeResultForm
                        sessionId={session.id}
                        onSuccess={mutate}
                      />
                    )}

                    {/* Link to session detail */}
                    <Link
                      href={`/sessions/${session.id}`}
                      className="flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      View session detail
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* No schedule yet */}
        {match.scheduleProposals.length === 0 &&
          isParticipant &&
          match.status !== "COMPLETED" &&
          match.status !== "CANCELED" && (
            <Button variant="outline" className="w-full" asChild>
              <Link href={`/matches/${match.id}/schedule`}>
                Propose a Schedule
              </Link>
            </Button>
          )}
      </div>
    );
  }
}
