"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";

// =============================================================================
// TYPES
// =============================================================================

interface Sport {
  id: string;
  name: string;
  slug: string;
}

interface Player {
  id: string;
  nickname: string;
  bio: string | null;
}

// =============================================================================
// NEW CHALLENGE PAGE
// =============================================================================

const fetcher = (url: string) => api.get<any>(url);

export default function NewChallengePage() {
  const router = useRouter();

  const [nickname, setNickname] = useState("");
  const [searchedPlayer, setSearchedPlayer] = useState<Player | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [sportId, setSportId] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: sports } = useSWR<Sport[]>("/sports", fetcher);

  async function handleSearch() {
    if (!nickname.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    setSearchedPlayer(null);

    try {
      const results = await api.get<Player[]>(
        `/players/search?q=${encodeURIComponent(nickname)}`
      );
      if (!results?.length) {
        setSearchError("No player found with that nickname.");
      } else {
        setSearchedPlayer(results[0]!);
      }
    } catch {
      setSearchError("Could not find player. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!searchedPlayer) {
      setError("Please search for and select a player first.");
      return;
    }
    if (!sportId) {
      setError("Please select a sport.");
      return;
    }

    setIsSubmitting(true);
    try {
      const challenge = await api.post<{ id: string }>("/challenges", {
        challengedId: searchedPlayer.id,
        sportId,
        requestNote: requestNote.trim() || undefined,
      });

      toast.success("Challenge sent!");
      router.push(`/challenges/${challenge.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.code) {
          case "SELF_CHALLENGE":
            setError("You cannot challenge yourself.");
            break;
          case "CHALLENGE_ALREADY_PENDING":
            setError(
              "You already have a pending challenge with this player."
            );
            break;
          default:
            setError(err.message);
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/challenges">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Challenge</h1>
          <p className="text-muted-foreground text-sm">
            Challenge another player to a match
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        {/* Player search */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Who do you want to challenge?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search by nickname..."
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSearch}
                disabled={isSearching || !nickname.trim()}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {searchError && (
              <p className="text-sm text-destructive">{searchError}</p>
            )}

            {searchedPlayer && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-accent/50">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">
                    {searchedPlayer.nickname[0]?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">{searchedPlayer.nickname}</p>
                  {searchedPlayer.bio && (
                    <p className="text-xs text-muted-foreground truncate max-w-xs">
                      {searchedPlayer.bio}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sport selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sport</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={sportId} onValueChange={setSportId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a sport..." />
              </SelectTrigger>
              <SelectContent>
                {sports?.map((sport) => (
                  <SelectItem key={sport.id} value={sport.id}>
                    {sport.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Optional message */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Message</CardTitle>
            <CardDescription>
              Optional — add a note to your challenge
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="e.g. Best of 3, bring your A game!"
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || !searchedPlayer || !sportId}
        >
          {isSubmitting ? "Sending..." : "Send Challenge"}
        </Button>
      </form>
    </div>
  );
}
