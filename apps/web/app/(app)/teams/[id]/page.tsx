"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
import { ArrowLeft, UserPlus, UserMinus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// =============================================================================
// TYPES
// =============================================================================

interface Player {
  id: string;
  nickname: string;
  bio: string | null;
}

interface TeamMember {
  role: string;
  joined_at: string;
  player: Player;
}

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_by: string;
  members: TeamMember[];
}

// =============================================================================
// HELPERS
// =============================================================================

const fetcher = (url: string) => api.get<any>(url);

// =============================================================================
// TEAM DETAIL PAGE
// =============================================================================

export default function TeamDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { player: authPlayer } = useAuth();
  const { toast } = useToast();

  const { data: team, isLoading, mutate } = useSWR<Team>(
    `/teams/${params.id}`,
    fetcher
  );

  // Add member search state
  const [searchNickname, setSearchNickname] = useState("");
  const [searchedPlayer, setSearchedPlayer] = useState<Player | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isActing, setIsActing] = useState(false);

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!team || !team.is_active) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <p className="text-muted-foreground">Team not found.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/profile">Back to profile</Link>
        </Button>
      </div>
    );
  }

  const myMembership = team.members.find(
    (m) => m.player.id === authPlayer?.id
  );
  const isOwner = myMembership?.role === "OWNER";
  const isMember = !!myMembership;

  async function handleSearch() {
    if (!searchNickname.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    setSearchedPlayer(null);

    try {
      const results = await api.get<Player[]>(
        `/players/search?q=${encodeURIComponent(searchNickname)}`
      );
      if (!results?.length) {
        setSearchError("No player found with that nickname.");
      } else {
        const alreadyMember = team.members.some(
          (m) => m.player.id === results[0]!.id
        );
        if (alreadyMember) {
          setSearchError("This player is already a member.");
        } else {
          setSearchedPlayer(results[0]!);
        }
      }
    } catch {
      setSearchError("Could not find player. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleAddMember() {
    if (!searchedPlayer) return;
    setIsAdding(true);
    try {
      await api.post(`/teams/${team.id}/members`, {
        playerId: searchedPlayer.id,
      });
      toast({ title: `${searchedPlayer.nickname} added to the team!` });
      setSearchNickname("");
      setSearchedPlayer(null);
      mutate();
    } catch (err) {
      toast({
        title: "Failed to add member",
        description: err instanceof ApiError ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemoveMember(playerId: string, nickname: string) {
    setIsActing(true);
    try {
      await api.delete(`/teams/${team.id}/members/${playerId}`);
      toast({ title: `${nickname} removed from the team` });
      mutate();
    } catch (err) {
      toast({
        title: "Failed to remove member",
        description: err instanceof ApiError ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsActing(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => history.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">
            {team.name}
          </h1>
          {team.description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {team.description}
            </p>
          )}
        </div>
      </div>

      {/* Members */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Members ({team.members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {team.members.map((member) => {
            const isMe = member.player.id === authPlayer?.id;
            const canRemove =
              (isOwner && !isMe) || (isMe && !isOwner);

            return (
              <div
                key={member.player.id}
                className="flex items-center justify-between py-2"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {member.player.nickname[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <Link
                      href={`/profile/${member.player.nickname}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {member.player.nickname}
                      {isMe && (
                        <span className="text-muted-foreground font-normal ml-1">
                          (you)
                        </span>
                      )}
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={member.role === "OWNER" ? "default" : "outline"}
                    className="text-xs capitalize"
                  >
                    {member.role.toLowerCase()}
                  </Badge>
                  {canRemove && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={isActing}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {isMe ? "Leave team?" : "Remove member?"}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {isMe
                              ? `You will leave ${team.name}.`
                              : `${member.player.nickname} will be removed from ${team.name}.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              handleRemoveMember(
                                member.player.id,
                                member.player.nickname
                              )
                            }
                          >
                            {isMe ? "Leave" : "Remove"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Add member — owner only */}
      {isOwner && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Add Member
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search by nickname..."
                value={searchNickname}
                onChange={(e) => setSearchNickname(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), handleSearch())
                }
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSearch}
                disabled={isSearching || !searchNickname.trim()}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {searchError && (
              <p className="text-sm text-destructive">{searchError}</p>
            )}

            {searchedPlayer && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-accent/50">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {searchedPlayer.nickname[0]?.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium">
                    {searchedPlayer.nickname}
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={handleAddMember}
                  disabled={isAdding}
                >
                  {isAdding ? "Adding..." : "Add"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
