"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Swords, Plus, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

// =============================================================================
// TYPES
// =============================================================================

interface Challenge {
  id: string;
  status: string;
  request_note: string | null;
  created_at: string;
  challenger: { id: string; nickname: string };
  challenged: { id: string; nickname: string };
  sport: { id: string; name: string };
}

interface MyChallenges {
  sent: Challenge[];
  received: Challenge[];
}

// =============================================================================
// HELPERS
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

function ChallengeStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// =============================================================================
// RECEIVED CHALLENGE CARD
// =============================================================================

function ReceivedChallengeCard({
  challenge,
  onAction,
}: {
  challenge: Challenge;
  onAction: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleAccept() {
    setIsLoading(true);
    try {
      await api.post(`/challenges/${challenge.id}/accept`);
      toast.success("Challenge accepted!");
      onAction();
    } catch (err) {
      toast.error("Failed to accept challenge", {
        description:
          err instanceof ApiError ? err.message : "Please try again",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReject() {
    setIsLoading(true);
    try {
      await api.post(`/challenges/${challenge.id}/reject`);
      toast.success("Challenge rejected");
      onAction();
    } catch (err) {
      toast.error("Failed to reject challenge", {
        description:
          err instanceof ApiError ? err.message : "Please try again",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              {challenge.challenger.nickname} challenged you
            </CardTitle>
            <CardDescription className="mt-1">
              {challenge.sport.name} ·{" "}
              {formatDistanceToNow(new Date(challenge.created_at), {
                addSuffix: true,
              })}
            </CardDescription>
          </div>
          <ChallengeStatusBadge status={challenge.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {challenge.request_note && (
          <p className="text-sm text-muted-foreground italic">
            &ldquo;{challenge.request_note}&rdquo;
          </p>
        )}

        {challenge.status === "PENDING" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAccept}
              disabled={isLoading}
              className="flex-1"
            >
              Accept
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isLoading}
                  className="flex-1"
                >
                  Reject
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject challenge?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reject {challenge.challenger.nickname}&apos;s challenge.
                    They will be notified.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReject}>
                    Reject
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {challenge.status !== "PENDING" && (
          <Link
            href={`/challenges/${challenge.id}`}
            className="flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View details
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// SENT CHALLENGE CARD
// =============================================================================

function SentChallengeCard({
  challenge,
  onAction,
}: {
  challenge: Challenge;
  onAction: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleWithdraw() {
    setIsLoading(true);
    try {
      await api.post(`/challenges/${challenge.id}/withdraw`);
      toast.success("Challenge withdrawn");
      onAction();
    } catch (err) {
      toast.error("Failed to withdraw challenge", {
        description:
          err instanceof ApiError ? err.message : "Please try again",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              vs {challenge.challenged.nickname}
            </CardTitle>
            <CardDescription className="mt-1">
              {challenge.sport.name} ·{" "}
              {formatDistanceToNow(new Date(challenge.created_at), {
                addSuffix: true,
              })}
            </CardDescription>
          </div>
          <ChallengeStatusBadge status={challenge.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {challenge.request_note && (
          <p className="text-sm text-muted-foreground italic">
            &ldquo;{challenge.request_note}&rdquo;
          </p>
        )}

        <div className="flex items-center justify-between">
          <Link
            href={`/challenges/${challenge.id}`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View details
            <ChevronRight className="h-4 w-4" />
          </Link>

          {challenge.status === "PENDING" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" disabled={isLoading}>
                  Withdraw
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Withdraw challenge?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will cancel your challenge to{" "}
                    {challenge.challenged.nickname}.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleWithdraw}>
                    Withdraw
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// CHALLENGES PAGE
// =============================================================================

export default function ChallengesPage() {
  const { data, isLoading, mutate: revalidate } = useSWR<MyChallenges>(
    "/challenges/mine",
    fetcher
  );

  const pendingReceivedCount =
    data?.received.filter((c) => c.status === "PENDING").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Challenges</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your challenges with other players
          </p>
        </div>

        <Button asChild>
          <Link href="/challenges/new">
            <Plus className="h-4 w-4 mr-2" />
            New Challenge
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="received">
        <TabsList className="w-full">
          <TabsTrigger value="received" className="flex-1">
            Received
            {pendingReceivedCount > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendingReceivedCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="sent" className="flex-1">
            Sent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="mt-4 space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </>
          ) : !data?.received.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Swords className="h-8 w-8 opacity-40" />
              <p className="text-sm">No challenges received yet</p>
            </div>
          ) : (
            data.received.map((challenge) => (
              <ReceivedChallengeCard
                key={challenge.id}
                challenge={challenge}
                onAction={() => revalidate()}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="sent" className="mt-4 space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </>
          ) : !data?.sent.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Swords className="h-8 w-8 opacity-40" />
              <p className="text-sm">No challenges sent yet</p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/challenges/new">Challenge someone</Link>
              </Button>
            </div>
          ) : (
            data.sent.map((challenge) => (
              <SentChallengeCard
                key={challenge.id}
                challenge={challenge}
                onAction={() => revalidate()}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}