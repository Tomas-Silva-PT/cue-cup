"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ArrowLeft, Clock } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { use } from "react";

// =============================================================================
// TYPES
// =============================================================================

interface ScheduleProposal {
  id: string;
  status: string;
  proposed_time: string;
  location: string | null;
  note: string | null;
  proposed_by: string;
  responded_at: string | null;
}

interface Match {
  id: string;
  status: string;
  participants: {
    side: string;
    player: { id: string; nickname: string };
  }[];
  scheduleProposals: ScheduleProposal[];
}

// =============================================================================
// HELPERS
// =============================================================================

const fetcher = (url: string) => api.get<any>(url);

const PROPOSAL_STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING:   { label: "Pending",   variant: "default" },
  ACCEPTED:  { label: "Accepted",  variant: "secondary" },
  REJECTED:  { label: "Rejected",  variant: "destructive" },
  EXPIRED:   { label: "Expired",   variant: "outline" },
  SUPERSEDED: { label: "Superseded", variant: "outline" },
};

// =============================================================================
// SCHEDULE PAGE
// =============================================================================

export default function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { player } = useAuth();
  const router = useRouter();
  const id = use(params).id;

  const { data: match, isLoading, mutate } = useSWR<Match>(
    `/matches/${id}`,
    fetcher
  );

  // Form state
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
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
    (p) => p.player.id === player?.id
  );
  const opponent = match.participants.find(
    (p) => p.player.id !== player?.id
  );
  const pendingProposal = match.scheduleProposals.find(
    (p) => p.status === "PENDING"
  );
  const canRespond =
    pendingProposal && pendingProposal.proposed_by !== player?.id;

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!date || !time) {
      setError("Please select a date and time.");
      return;
    }

    const datetime = new Date(`${date}T${time}`);
    if (datetime <= new Date()) {
      setError("The proposed time must be in the future.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/schedule/matches/${id}/propose`, {
        datetime: datetime.toISOString(),
        location: location.trim() || undefined,
        note: note.trim() || undefined,
      });

      toast.success("Schedule proposed!");
      setDate("");
      setTime("");
      setLocation("");
      setNote("");
      mutate();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRespond(proposalId: string, action: "accept" | "reject") {
    setIsResponding(true);
    try {
      await api.post(`/schedule/proposals/${proposalId}/${action}`);
      toast.success(action === "accept" ? "Schedule accepted!" : "Schedule rejected");
      mutate();
      if (action === "accept") {
        router.push(`/matches/${id}`);
      }
    } catch (err) {
      toast.error(`Failed to ${action} proposal`, {
        description: err instanceof ApiError ? err.message : "Please try again",
      });
    } finally {
      setIsResponding(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/matches/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule Match</h1>
          <p className="text-muted-foreground text-sm">
            vs {opponent?.player.nickname}
          </p>
        </div>
      </div>

      {/* Pending proposal — show accept/reject if the other player proposed */}
      {pendingProposal && (
        <Card className={canRespond ? "border-primary" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {canRespond ? "Incoming Proposal" : "Your Proposal"}
              </CardTitle>
              <Badge variant="default">Pending</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <p className="text-lg font-semibold">
                {format(
                  new Date(pendingProposal.proposed_time),
                  "EEEE, MMMM d · HH:mm"
                )}
              </p>
              {pendingProposal.location && (
                <p className="text-sm text-muted-foreground">
                  📍 {pendingProposal.location}
                </p>
              )}
              {pendingProposal.note && (
                <p className="text-sm text-muted-foreground italic">
                  &ldquo;{pendingProposal.note}&rdquo;
                </p>
              )}
            </div>

            {canRespond && (
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1"
                  disabled={isResponding}
                  onClick={() => handleRespond(pendingProposal.id, "accept")}
                >
                  Accept
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={isResponding}
                  onClick={() => handleRespond(pendingProposal.id, "reject")}
                >
                  Reject
                </Button>
              </div>
            )}

            {!canRespond && (
              <p className="text-xs text-muted-foreground">
                Waiting for {opponent?.player.nickname} to respond
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Propose new schedule */}
      {isParticipant && match.status !== "COMPLETED" && match.status !== "CANCELED" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {pendingProposal && pendingProposal.proposed_by === player?.id
                ? "Update Proposal"
                : "Propose a Time"}
            </CardTitle>
            <CardDescription>
              {pendingProposal
                ? "Proposing a new time will supersede the current pending proposal"
                : `Suggest a date and time to ${opponent?.player.nickname}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePropose} className="space-y-4">
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g. Mesa 3 do Clube"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Note</Label>
                <Input
                  id="note"
                  placeholder="Optional message..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !date || !time}
              >
                {isSubmitting ? "Sending..." : "Send Proposal"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Proposal history */}
      {match.scheduleProposals.filter((p) => p.status !== "PENDING").length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {match.scheduleProposals
              .filter((p) => p.status !== "PENDING")
              .map((proposal) => {
                const config = PROPOSAL_STATUS_CONFIG[proposal.status] ?? {
                  label: proposal.status,
                  variant: "outline" as const,
                };
                return (
                  <div
                    key={proposal.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="text-sm">
                        {format(
                          new Date(proposal.proposed_time),
                          "EEE, MMM d · HH:mm"
                        )}
                      </p>
                      {proposal.location && (
                        <p className="text-xs text-muted-foreground">
                          {proposal.location}
                        </p>
                      )}
                    </div>
                    <Badge variant={config.variant} className="text-xs">
                      {config.label}
                    </Badge>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
