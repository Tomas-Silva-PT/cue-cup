"use client";

import { use, useState, useEffect } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// =============================================================================
// TYPES
// =============================================================================

type PhaseType =
  | "ROUND_ROBIN"
  | "SINGLE_ELIMINATION"
  | "DOUBLE_ELIMINATION"
  | "SWISS"
  | "LEAGUE";

interface Phase {
  id: string;
  name: string;
  description: string | null;
  order: number;
  type: PhaseType;
  status: string;
  config: Record<string, unknown>;
  tournament: { id: string; name: string };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SUPPORTS_GROUPS: Record<PhaseType, boolean> = {
  ROUND_ROBIN: true,
  LEAGUE: true,
  SINGLE_ELIMINATION: false,
  DOUBLE_ELIMINATION: false,
  SWISS: false,
};

const SUPPORTS_POINTS: Record<PhaseType, boolean> = {
  ROUND_ROBIN: false,
  LEAGUE: true,
  SINGLE_ELIMINATION: false,
  DOUBLE_ELIMINATION: false,
  SWISS: false,
};

// =============================================================================
// EDIT PHASE PAGE
// =============================================================================

const fetcher = (url: string) => api.get<any>(url);

export default function EditPhasePage({
  params,
}: {
  params: Promise<{ id: string; phaseId: string }>;
}) {
  const { id, phaseId } = use(params);
  const router = useRouter();

  const { data: phase, isLoading } = useSWR<Phase>(
    `/tournaments/${id}/phases/${phaseId}`,
    fetcher
  );

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<PhaseType>("ROUND_ROBIN");
  const [matchGeneration, setMatchGeneration] = useState<"auto" | "manual">("auto");
  const [seeding, setSeeding] = useState<"random" | "by_seed">("random");
  const [groups, setGroups] = useState(1);
  const [advanceTopN, setAdvanceTopN] = useState(1);
  const [bestOf, setBestOf] = useState(1);
  const [thirdPlaceMatch, setThirdPlaceMatch] = useState(false);
  const [rounds, setRounds] = useState(7);
  const [pointsWin, setPointsWin] = useState(3);
  const [pointsDraw, setPointsDraw] = useState(1);
  const [pointsLoss, setPointsLoss] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form once phase data loads
  useEffect(() => {
    if (!phase) return;
    const c = phase.config;
    setName(phase.name);
    setDescription(phase.description ?? "");
    setType(phase.type);
    setMatchGeneration((c.matchGeneration as "auto" | "manual") ?? "auto");
    setSeeding((c.seeding as "random" | "by_seed") ?? "random");
    setGroups((c.groups as number) ?? 1);
    setAdvanceTopN((c.advanceTopN as number) ?? 1);
    setBestOf((c.bestOf as number) ?? 1);
    setThirdPlaceMatch((c.thirdPlaceMatch as boolean) ?? false);
    setRounds((c.rounds as number) ?? 7);
    setPointsWin((c.pointsWin as number) ?? 3);
    setPointsDraw((c.pointsDraw as number) ?? 1);
    setPointsLoss((c.pointsLoss as number) ?? 0);
  }, [phase]);

  function buildConfig() {
    const base = { matchGeneration, seeding, bestOf, advanceTopN };
    if (type === "ROUND_ROBIN" || type === "LEAGUE") {
      return {
        ...base,
        groups,
        ...(type === "LEAGUE" && { pointsWin, pointsDraw, pointsLoss }),
      };
    }
    if (type === "SINGLE_ELIMINATION") return { ...base, thirdPlaceMatch };
    if (type === "SWISS") return { ...base, rounds };
    return base;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await api.patch(`/tournaments/${id}/phases/${phaseId}`, {
        name,
        description: description.trim() || undefined,
        type,
        config: buildConfig(),
      });

      toast.success("Phase updated!");
      router.push(`/tournaments/${id}`);
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

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (!phase) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <p className="text-muted-foreground">Phase not found.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href={`/tournaments/${id}`}>Back to tournament</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/tournaments/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Phase</h1>
          <p className="text-muted-foreground text-sm">{phase.tournament.name}</p>
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Match generation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Match Generation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-generate matches</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Matches created automatically when phase starts
                </p>
              </div>
              <Switch
                checked={matchGeneration === "auto"}
                onCheckedChange={(v) => setMatchGeneration(v ? "auto" : "manual")}
              />
            </div>
            {matchGeneration === "auto" && (
              <div className="space-y-2">
                <Label>Seeding</Label>
                <Select value={seeding} onValueChange={(v) => setSeeding(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Random</SelectItem>
                    <SelectItem value="by_seed">By seed number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Groups — ROUND_ROBIN and LEAGUE only */}
        {SUPPORTS_GROUPS[type] && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Groups</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="groups">Number of groups</Label>
                <Input
                  id="groups"
                  type="number"
                  min={1}
                  max={16}
                  value={groups}
                  onChange={(e) => setGroups(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="advanceTopN">Players advancing per group</Label>
                <Input
                  id="advanceTopN"
                  type="number"
                  min={1}
                  value={advanceTopN}
                  onChange={(e) => setAdvanceTopN(Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Points — LEAGUE only */}
        {SUPPORTS_POINTS[type] && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Points System</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="pointsWin">Win</Label>
                  <Input
                    id="pointsWin"
                    type="number"
                    min={0}
                    value={pointsWin}
                    onChange={(e) => setPointsWin(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pointsDraw">Draw</Label>
                  <Input
                    id="pointsDraw"
                    type="number"
                    min={0}
                    value={pointsDraw}
                    onChange={(e) => setPointsDraw(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pointsLoss">Loss</Label>
                  <Input
                    id="pointsLoss"
                    type="number"
                    min={0}
                    value={pointsLoss}
                    onChange={(e) => setPointsLoss(Number(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Match format — elimination and swiss */}
        {(type === "SINGLE_ELIMINATION" ||
          type === "DOUBLE_ELIMINATION" ||
          type === "SWISS") && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Match Format</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bestOf">Best of</Label>
                <Select
                  value={String(bestOf)}
                  onValueChange={(v) => setBestOf(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Best of 1</SelectItem>
                    <SelectItem value="3">Best of 3</SelectItem>
                    <SelectItem value="5">Best of 5</SelectItem>
                    <SelectItem value="7">Best of 7</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {type === "SINGLE_ELIMINATION" && (
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Third place match</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Match between the two semi-final losers
                    </p>
                  </div>
                  <Switch
                    checked={thirdPlaceMatch}
                    onCheckedChange={setThirdPlaceMatch}
                  />
                </div>
              )}
              {type === "SWISS" && (
                <div className="space-y-2">
                  <Label htmlFor="rounds">Number of rounds</Label>
                  <Input
                    id="rounds"
                    type="number"
                    min={1}
                    value={rounds}
                    onChange={(e) => setRounds(Number(e.target.value))}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" asChild>
            <Link href={`/tournaments/${id}`}>Cancel</Link>
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={isSubmitting || !name}
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
