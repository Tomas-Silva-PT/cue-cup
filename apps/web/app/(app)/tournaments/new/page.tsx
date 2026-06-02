"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
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
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

// =============================================================================
// TYPES
// =============================================================================

interface Sport {
  id: string;
  name: string;
  slug: string;
}

// =============================================================================
// NEW TOURNAMENT PAGE
// =============================================================================

const fetcher = (url: string) => api.get<any>(url);

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; 
// remove: I, O, 0, 1

function generateInviteCode(length = 6) {
  let result = "";
  const bytes = crypto.getRandomValues(new Uint8Array(length));

  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return result;
}

export default function NewTournamentPage() {
  const router = useRouter();
  const { data: sports } = useSWR<Sport[]>("/sports", fetcher);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [sportId, setSportId] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PRIVATE");
  const [minPlayers, setMinPlayers] = useState(2);
  const [maxPlayers, setMaxPlayers] = useState<number | "">(16);
  const [teamBased, setTeamBased] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteCode] = useState(() => generateInviteCode());

  function handleNameChange(value: string) {
    setName(value);
    if (!slugManuallyEdited) {
      setSlug(generateSlug(value));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!sportId) {
      setError("Please select a sport.");
      return;
    }

    setIsSubmitting(true);
    try {
      const tournament = await api.post<{ id: string }>("/tournaments", {
        name,
        slug,
        description: description.trim() || undefined,
        sportId,
        visibility,
        minPlayers,
        maxPlayers: maxPlayers || undefined,
        teamBased,
      });

      toast.success("Tournament created!");
      router.push(`/tournaments/${tournament.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.code) {
          case "SLUG_TAKEN":
            setError("This slug is already taken. Please choose a different one.");
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
          <Link href="/tournaments">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Tournament</h1>
          <p className="text-muted-foreground text-sm">
            Set up a new tournament
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        {/* Basic info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Summer Championship 2025"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                placeholder="summer-championship-2025"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugManuallyEdited(true);
                }}
                required
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier used in the URL. Auto-generated from the name.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility(v as "PUBLIC" | "PRIVATE")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIVATE">
                    Private — invite only
                  </SelectItem>
                  <SelectItem value="PUBLIC">
                    Public — anyone can join
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Sport */}
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

        {/* Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minPlayers">Min players</Label>
                <Input
                  id="minPlayers"
                  type="number"
                  min={2}
                  value={minPlayers}
                  onChange={(e) => setMinPlayers(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPlayers">Max players</Label>
                <Input
                  id="maxPlayers"
                  type="number"
                  min={2}
                  value={maxPlayers}
                  onChange={(e) =>
                    setMaxPlayers(e.target.value ? Number(e.target.value) : "")
                  }
                  placeholder="No limit"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="teamBased">Team-based</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Group players by team for seeding and scoring
                </p>
              </div>
              <Switch
                id="teamBased"
                checked={teamBased}
                onCheckedChange={setTeamBased}
              />
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || !name || !slug || !sportId}
        >
          {isSubmitting ? "Creating..." : "Create Tournament"}
        </Button>
      </form>
    </div>
  );
}
