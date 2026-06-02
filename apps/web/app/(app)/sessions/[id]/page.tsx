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
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// =============================================================================
// TYPES
// =============================================================================

interface HistoryEntry {
  score_home: number;
  score_away: number;
  changed_by: string;
  changed_at: string;
}

interface Result {
  id: string;
  score_home: number;
  score_away: number;
  status: string;
  proposed_by: string;
  confirmed_at: string | null;
  history: HistoryEntry[];
}

interface Session {
  id: string;
  number: number;
  status: string;
  location: string | null;
  note: string | null;
  started_at: string;
  ended_at: string | null;
  result: Result | null;
  match: {
    id: string;
    status: string;
    participants: {
      side: string;
      player: { id: string; nickname: string };
    }[];
  };
}

// =============================================================================
// HELPERS
// =============================================================================

const fetcher = (url: string) => api.get<any>(url);

const RESULT_STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PROPOSED:  { label: "Proposed",  variant: "outline" },
  CONFIRMED: { label: "Confirmed", variant: "secondary" },
  DISPUTED:  { label: "Disputed",  variant: "destructive" },
  REJECTED:  { label: "Rejected",  variant: "destructive" },
};

// =============================================================================
// SESSION DETAIL PAGE
// =============================================================================

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { player } = useAuth();
  const [scoreHome, setScoreHome] = useState(0);
  const [scoreAway, setScoreAway] = useState(0);
  const [isActing, setIsActing] = useState(false);
    const {id} = use(params);

  const { data: session, isLoading, mutate } = useSWR<Session>(
    `/sessions/${id}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <p className="text-muted-foreground">Session not found.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  const isParticipant = session.match.participants.some(
    (p) => p.player.id === player?.id
  );
  const homePlayer = session.match.participants.find((p) => p.side === "HOME");
  const awayPlayer = session.match.participants.find((p) => p.side === "AWAY");

  const resultConfig = session.result
    ? RESULT_STATUS_CONFIG[session.result.status]
    : null;

  const canPropose =
    isParticipant &&
    session.status === "IN_PROGRESS" &&
    (!session.result ||
      session.result.status === "DISPUTED" ||
      session.result.status === "REJECTED");

  const canConfirm =
    isParticipant &&
    session.result?.status === "PROPOSED" &&
    session.result.proposed_by !== player?.id;

  const canDispute =
    isParticipant &&
    session.result?.status === "PROPOSED" &&
    session.result.proposed_by !== player?.id;

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    setIsActing(true);
    try {
      await api.post(`/sessions/${id}/result`, {
        scoreHome,
        scoreAway,
      });
      toast.success("Result proposed!");
      mutate();
    } catch (err) {
      toast.error( "Failed to propose result",{
        description: err instanceof ApiError ? err.message : "Please try again",
      });
    } finally {
      setIsActing(false);
    }
  }

  async function handleResultAction(action: "confirm" | "dispute") {
    setIsActing(true);
    try {
      await api.post(`/sessions/${id}/result/${action}`);
      toast.success(action === "confirm" ? "Result confirmed!" : "Result disputed");
      mutate();
    } catch (err) {
      toast.error(`Failed to ${action} result`, {
        description: err instanceof ApiError ? err.message : "Please try again",
      });
    } finally {
      setIsActing(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/matches/${session.match.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">
            Session {session.number}
          </h1>
          <p className="text-sm text-muted-foreground">
            {homePlayer?.player.nickname} vs {awayPlayer?.player.nickname}
          </p>
        </div>
        <Badge variant="outline">{session.status}</Badge>
      </div>

      {/* Session info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Started</span>
            <span>{format(new Date(session.started_at), "EEE, MMM d · HH:mm")}</span>
          </div>
          {session.ended_at && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ended</span>
              <span>{format(new Date(session.ended_at), "EEE, MMM d · HH:mm")}</span>
            </div>
          )}
          {session.location && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Location</span>
              <span>{session.location}</span>
            </div>
          )}
          {session.note && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Note</p>
              <p className="text-sm">{session.note}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current result */}
      {session.result && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Result</CardTitle>
              {resultConfig && (
                <Badge variant={resultConfig.variant}>
                  {resultConfig.label}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {homePlayer?.player.nickname}
                </p>
                <p className="text-4xl font-bold">
                  {session.result.score_home}
                </p>
              </div>
              <span className="text-xl text-muted-foreground">—</span>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {awayPlayer?.player.nickname}
                </p>
                <p className="text-4xl font-bold">
                  {session.result.score_away}
                </p>
              </div>
            </div>

            {/* Confirm / Dispute actions */}
            {(canConfirm || canDispute) && (
              <div className="flex gap-2">
                {canConfirm && (
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={isActing}
                    onClick={() => handleResultAction("confirm")}
                  >
                    Confirm Result
                  </Button>
                )}
                {canDispute && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={isActing}
                    onClick={() => handleResultAction("dispute")}
                  >
                    Dispute
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Propose / update result */}
      {canPropose && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {session.result ? "Update Result" : "Propose Result"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePropose} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">
                    {homePlayer?.player.nickname} (Home)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={scoreHome}
                    onChange={(e) => setScoreHome(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {awayPlayer?.player.nickname} (Away)
                  </Label>
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
                disabled={isActing}
              >
                {isActing ? "Submitting..." : session.result ? "Update" : "Propose"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Result history */}
      {session.result?.history && session.result.history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Result History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {session.result.history.map((entry, index) => (
              <div
                key={index}
                className="flex items-center justify-between text-sm py-1 border-b last:border-0"
              >
                <span className="text-muted-foreground">
                  {format(new Date(entry.changed_at), "MMM d · HH:mm")}
                </span>
                <span>
                  {entry.score_home} — {entry.score_away}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
