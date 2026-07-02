"use client";

import { use, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
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
import { ArrowLeft, Users, Trophy, ChevronRight, Play, X, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

// =============================================================================
// TYPES
// =============================================================================

interface Participant {
  id: string;
  status: string;
  player: { id: string; nickname: string };
}

interface PhaseGroup {
  id: string;
  name: string;
  order: number;
  matches: { id: string; status: string }[];
}

interface Phase {
  id: string;
  name: string;
  order: number;
  type: string;
  status: string;
  groups: PhaseGroup[];
}

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  status: string;
  visibility: string;
  min_players: number;
  max_players: number | null;
  teamBased: boolean;
  invitation_code: string | null;
  created_by: string;
  sport: { id: string; name: string };
  creator: { id: string; nickname: string };
  tournamentParticipants: Participant[];
  phases: Phase[];
}

// =============================================================================
// HELPERS
// =============================================================================

const fetcher = (url: string) => api.get<any>(url);

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  DRAFT:     { label: "Draft",     variant: "outline" },
  OPEN:      { label: "Open",      variant: "default" },
  ONGOING:   { label: "Ongoing",   variant: "default" },
  COMPLETED: { label: "Completed", variant: "secondary" },
  CANCELED:  { label: "Canceled",  variant: "destructive" },
};

const PHASE_TYPE_LABELS: Record<string, string> = {
  ROUND_ROBIN:        "Round Robin",
  SINGLE_ELIMINATION: "Single Elimination",
  DOUBLE_ELIMINATION: "Double Elimination",
  SWISS:              "Swiss",
  LEAGUE:             "League",
};

// =============================================================================
// TOURNAMENT DETAIL PAGE
// =============================================================================

export default function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
})
{
  const { id } = use(params); {
  const { player } = useAuth();
  const { data: tournament, isLoading, mutate } = useSWR<Tournament>(
    `/tournaments/${id}`,
    fetcher
  );
  const [isActing, setIsActing] = useState(false);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-muted-foreground">Tournament not found.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/tournaments">Back to tournaments</Link>
        </Button>
      </div>
    );
  }

  const isCreator = player?.id === tournament.created_by;
  const statusConfig = STATUS_CONFIG[tournament.status] ?? {
    label: tournament.status,
    variant: "outline" as const,
  };

  const confirmedParticipants = tournament.tournamentParticipants.filter(
    (p) => p.status === "ACCEPTED"
  );

  async function handleOpen() {
    setIsActing(true);
    try {
      await api.post(`/tournaments/${tournament!.id}/open`);
      toast.success("Registration opened!");
      mutate();
    } catch (err) {
      toast.error("Failed to open registration",
        {description: err instanceof ApiError ? err.message : "Please try again",}
        );
    } finally {
      setIsActing(false);
    }
  }

  async function handleStart() {
    setIsActing(true);
    try {
      await api.post(`/tournaments/${tournament!.id}/start`);
      toast.success("Tournament started!");
      mutate();
    } catch (err) {
      toast.error("Failed to start tournament",
        {description: err instanceof ApiError ? err.message : "Please try again",}
      );
    } finally {
      setIsActing(false);
    }
  }

  async function handleCancel() {
    setIsActing(true);
    try {
      await api.post(`/tournaments/${tournament!.id}/cancel`);
      toast.success("Tournament cancelled");
      mutate();
    } catch (err) {
      toast.error("Failed to cancel tournament", {
        description: err instanceof ApiError ? err.message : "Please try again",
      });
    } finally {
      setIsActing(false);
    }
  }

  async function handleJoin() {
    setIsActing(true);
    try {
      await api.post(`/tournaments/${tournament!.id}/join`);
      toast.success("Joined tournament!");
      mutate();
    } catch (err) {
      toast.error("Failed to join tournament", {
        description: err instanceof ApiError ? err.message : "Please try again",
      });
    } finally {
      setIsActing(false);
    }
  }

  const isParticipant = tournament.tournamentParticipants.some(
    (p) => p.player.id === player?.id
  );

  const canJoin =
    tournament.status === "OPEN" &&
    !isParticipant &&
    !isCreator;

  const canOpen =
    isCreator &&
    tournament.status === "DRAFT";

  const canStart =
    isCreator &&
    (tournament.status === "DRAFT" || tournament.status === "OPEN") &&
    confirmedParticipants.length >= tournament.min_players;

  const canCancel =
    isCreator &&
    tournament.status !== "COMPLETED" &&
    tournament.status !== "CANCELED";

  async function handleDeletePhase(phaseId: string) {
    setIsActing(true);
    try {
      await api.delete(`/tournaments/${id}/phases/${phaseId}`);
      toast.success("Phase deleted");
      mutate();
    } catch (err) {
      toast.error("Failed to delete phase", {
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
          <Link href="/tournaments">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">
            {tournament.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            {tournament.sport.name} · by {tournament.creator.nickname}
          </p>
        </div>
        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
      </div>

      {/* Description */}
      {tournament.description && (
        <p className="text-sm text-muted-foreground">{tournament.description}</p>
      )}

      {/* Creator actions */}
      {isCreator && (
        <div className="flex gap-2 flex-wrap">
          {canOpen && (
            <Button
              onClick={handleOpen}
              disabled={isActing}
              size="sm"
              variant="outline"
            >
              Open Registration
            </Button>
          )}
          {canStart && (
            <Button onClick={handleStart} disabled={isActing} size="sm">
              <Play className="h-4 w-4 mr-2" />
              Start Tournament
            </Button>
          )}
          {canCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isActing}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel Tournament
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel tournament?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will cancel the tournament. All participants will be
                    notified. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep tournament</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel}>
                    Cancel tournament
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      {/* Join button */}
      {canJoin && (
        <Button onClick={handleJoin} disabled={isActing} className="w-full">
          Join Tournament
        </Button>
      )}

      {/* Invite code */}
      {isCreator && tournament.invitation_code && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Invite Code</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <code className="text-lg font-mono font-bold tracking-widest bg-muted px-4 py-2 rounded-md">
                {tournament.invitation_code}
              </code>
              <p className="text-xs text-muted-foreground">
                Share this code with players you want to invite
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Visibility</span>
            <span className="font-medium capitalize">
              {tournament.visibility.toLowerCase()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Players</span>
            <span className="font-medium">
              {confirmedParticipants.length}
              {tournament.max_players ? ` / ${tournament.max_players}` : ""}
              {" "}(min {tournament.min_players})
            </span>
          </div>
          {tournament.teamBased && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Format</span>
              <span className="font-medium">Team-based</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Participants */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Participants ({confirmedParticipants.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!confirmedParticipants.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No confirmed participants yet
            </p>
          ) : (
            <div className="space-y-2">
              {confirmedParticipants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 py-1"
                >
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {p.player.nickname[0]?.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium">
                    {p.player.nickname}
                    {p.player.id === player?.id && (
                      <span className="text-muted-foreground font-normal"> (you)</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phases */}
      {tournament.phases.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Phases
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tournament.phases
              .sort((a, b) => a.order - b.order)
              .map((phase) => (
                <div key={phase.id} className="flex items-center gap-2">
                  <Link
                    href={`/tournaments/${tournament.id}/phases/${phase.id}`}
                    className="flex-1 flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">{phase.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {PHASE_TYPE_LABELS[phase.type] ?? phase.type}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {phase.status}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>

                  {isCreator &&
                    phase.status === "PENDING" &&
                    (tournament.status === "DRAFT" || tournament.status === "OPEN") && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          asChild
                        >
                          <Link href={`/tournaments/${tournament.id}/phases/${phase.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={isActing}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete phase?</AlertDialogTitle>
                              <AlertDialogDescription>
                                &ldquo;{phase.name}&rdquo; will be permanently deleted.
                                This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={() => handleDeletePhase(phase.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Add phase — creator only, tournament ongoing */}
      {isCreator && tournament.status === "DRAFT" && (
        <Button variant="outline" className="w-full" asChild>
          <Link href={`/tournaments/${tournament.id}/phases/new`}>
            Add Phase
          </Link>
        </Button>
      )}
    </div>
  );
}
}