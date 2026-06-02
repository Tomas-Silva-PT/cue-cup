"use client";

import useSWR, { mutate } from "swr";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Plus, ChevronRight, Users } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// =============================================================================
// TYPES
// =============================================================================

interface Tournament {
  id: string;
  name: string;
  slug: string;
  status: string;
  visibility: string;
  sport: { id: string; name: string };
  creator: { id: string; nickname: string };
  _count?: { tournamentParticipants: number };
}

interface MyTournaments {
  created: Tournament[];
  participating: Tournament[];
}

// =============================================================================
// HELPERS
// =============================================================================

const fetcher = (url: string) => api.get<any>(url);

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  DRAFT: { label: "Draft", variant: "outline" },
  OPEN: { label: "Open", variant: "default" },
  ONGOING: { label: "Ongoing", variant: "default" },
  COMPLETED: { label: "Completed", variant: "secondary" },
  CANCELED: { label: "Canceled", variant: "destructive" },
};

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const statusConfig = STATUS_CONFIG[tournament.status] ?? {
    label: tournament.status,
    variant: "outline" as const,
  };

  return (
    <Link href={`/tournaments/${tournament.id}`}>
      <Card className="hover:bg-accent transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base truncate">
                {tournament.name}
              </CardTitle>
              <CardDescription className="mt-1">
                {tournament.sport.name} · by {tournament.creator.nickname}
              </CardDescription>
            </div>
            <Badge variant={statusConfig.variant} className="shrink-0">
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>
                {tournament._count?.tournamentParticipants ?? 0} players
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// =============================================================================
// TOURNAMENTS PAGE
// =============================================================================

export default function TournamentsPage() {
  const { data, isLoading } = useSWR<MyTournaments>(
    "/tournaments/mine",
    fetcher,
  );
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  async function handleJoinTournament() {
    try {
      setJoining(true);

      await api.post(`/tournaments/${joinCode}/join`, {
        inviteCode: joinCode.toUpperCase(),
      });

      setJoinCode("");

      // Atualiza o SWR
      mutate("/tournaments/mine");
      toast.success("Joined tournament successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to join tournament", {
        description: error instanceof Error ? error.message : "An unknown error occurred",});
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tournaments</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your tournaments and competitions
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Join Tournament</Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join Tournament</DialogTitle>
                <DialogDescription>
                  Enter the 6-letter invitation code.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <Input
                  placeholder="ABCDEF"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                    )
                  }
                  className="text-center tracking-widest uppercase"
                />

                <Button
                  className="w-full"
                  disabled={joinCode.length !== 6 || joining}
                  onClick={handleJoinTournament}
                >
                  Join Tournament
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button asChild>
            <Link href="/tournaments/new">
              <Plus className="h-4 w-4 mr-2" />
              New Tournament
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="participating">
        <TabsList className="w-full">
          <TabsTrigger value="participating" className="flex-1">
            Participating
          </TabsTrigger>
          <TabsTrigger value="created" className="flex-1">
            Created
          </TabsTrigger>
        </TabsList>

        <TabsContent value="participating" className="mt-4 space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </>
          ) : !data?.participating.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Trophy className="h-8 w-8 opacity-40" />
              <p className="text-sm">
                You are not participating in any tournaments
              </p>
            </div>
          ) : (
            data.participating.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))
          )}
        </TabsContent>

        <TabsContent value="created" className="mt-4 space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </>
          ) : !data?.created.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Trophy className="h-8 w-8 opacity-40" />
              <p className="text-sm">
                You haven&apos;t created any tournaments yet
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/tournaments/new">Create one</Link>
              </Button>
            </div>
          ) : (
            data.created.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
