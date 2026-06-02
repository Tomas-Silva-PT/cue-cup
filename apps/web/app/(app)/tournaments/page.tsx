"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trophy, Plus, ChevronRight, Users, KeyRound, Search } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  DRAFT:     { label: "Draft",     variant: "outline" },
  OPEN:      { label: "Open",      variant: "default" },
  ONGOING:   { label: "Ongoing",   variant: "default" },
  COMPLETED: { label: "Completed", variant: "secondary" },
  CANCELED:  { label: "Canceled",  variant: "destructive" },
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
              <CardTitle className="text-base truncate">{tournament.name}</CardTitle>
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
              <span>{tournament._count?.tournamentParticipants ?? 0} players</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// =============================================================================
// JOIN WITH INVITE CODE DIALOG
// =============================================================================

function JoinWithCodeDialog() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Find the tournament by invite code first
      const tournament = await api.get<Tournament>(
        `/tournaments/by-code/${code.trim().toUpperCase()}`
      );
      // Then join it
      await api.post(`/tournaments/${tournament.id}/join`, {
        inviteCode: code.trim().toUpperCase(),
      });
      toast.success("Joined tournament!");
      setOpen(false);
      router.push(`/tournaments/${tournament.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.code) {
          case "TOURNAMENT_NOT_FOUND":
            setError("No tournament found with that code.");
            break;
          case "INVALID_INVITE_CODE":
            setError("Invalid invite code.");
            break;
          case "ALREADY_PARTICIPATING":
            setError("You are already a participant in this tournament.");
            break;
          case "TOURNAMENT_FULL":
            setError("This tournament is full.");
            break;
          case "TOURNAMENT_NOT_OPEN":
            setError("This tournament is not open for registration.");
            break;
          default:
            setError(err.message);
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound className="h-4 w-4 mr-2" />
          Join with Code
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join with Invite Code</DialogTitle>
          <DialogDescription>
            Enter the invite code shared by the tournament organiser
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleJoin} className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="code">Invite Code</Label>
            <Input
              id="code"
              placeholder="e.g. VERAO25"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono tracking-widest text-center text-lg uppercase"
              maxLength={8}
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={isLoading || !code.trim()}
              className="w-full"
            >
              {isLoading ? "Joining..." : "Join Tournament"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// PUBLIC TOURNAMENTS TAB
// =============================================================================

function PublicTournaments({
  myTournaments,
}: {
  myTournaments?: MyTournaments;
}) {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const { data: publicTournaments, isLoading } = useSWR<Tournament[]>(
    `/tournaments/public`,
    fetcher
  );

  // Filter out tournaments the player is already in
  const myIds = new Set([
    ...(myTournaments?.created.map((t) => t.id) ?? []),
    ...(myTournaments?.participating.map((t) => t.id) ?? []),
  ]);

  const available = (publicTournaments ?? []).filter(
    (t) =>
      !myIds.has(t.id) &&
      t.status === "OPEN" &&
      (search === "" ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.sport.name.toLowerCase().includes(search.toLowerCase()))
  );

  async function handleJoin(tournament: Tournament) {
    try {
      await api.post(`/tournaments/${tournament.id}/join`);
      toast.success(`Joined ${tournament.name}!`);
      router.push(`/tournaments/${tournament.id}`);
    } catch (err) {
      toast.error("Failed to join", {
        description: err instanceof ApiError ? err.message : "Please try again",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tournaments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <>
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </>
      ) : !available.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Trophy className="h-8 w-8 opacity-40" />
          <p className="text-sm">
            {search ? "No tournaments match your search" : "No open public tournaments"}
          </p>
        </div>
      ) : (
        available.map((tournament) => {
          const statusConfig = STATUS_CONFIG[tournament.status] ?? {
            label: tournament.status,
            variant: "outline" as const,
          };
          return (
            <Card key={tournament.id}>
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
                  <Button
                    size="sm"
                    onClick={() => handleJoin(tournament)}
                  >
                    Join
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

// =============================================================================
// TOURNAMENTS PAGE
// =============================================================================

export default function TournamentsPage() {
  const { data, isLoading } = useSWR<MyTournaments>("/tournaments/mine", fetcher);

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
          <JoinWithCodeDialog />
          <Button asChild>
            <Link href="/tournaments/new">
              <Plus className="h-4 w-4 mr-2" />
              New
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="participating">
        <TabsList className="w-full">
          <TabsTrigger value="participating" className="flex-1">Participating</TabsTrigger>
          <TabsTrigger value="created" className="flex-1">Created</TabsTrigger>
          <TabsTrigger value="discover" className="flex-1">Discover</TabsTrigger>
        </TabsList>

        {/* Participating */}
        <TabsContent value="participating" className="mt-4 space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </>
          ) : !data?.participating.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Trophy className="h-8 w-8 opacity-40" />
              <p className="text-sm">You are not participating in any tournaments</p>
              <p className="text-xs">Join a public one or use an invite code</p>
            </div>
          ) : (
            data.participating.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))
          )}
        </TabsContent>

        {/* Created */}
        <TabsContent value="created" className="mt-4 space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </>
          ) : !data?.created.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Trophy className="h-8 w-8 opacity-40" />
              <p className="text-sm">You haven&apos;t created any tournaments yet</p>
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

        {/* Discover — public tournaments */}
        <TabsContent value="discover" className="mt-4">
          <PublicTournaments myTournaments={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
