"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
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

type PhaseType =
  | "ROUND_ROBIN"
  | "SINGLE_ELIMINATION"
  | "DOUBLE_ELIMINATION"
  | "SWISS"
  | "LEAGUE";

type MatchGeneration = "auto" | "manual";
type Seeding = "random" | "by_seed";

// =============================================================================
// CONSTANTS
// =============================================================================

const PHASE_TYPE_OPTIONS: { value: PhaseType; label: string; description: string }[] = [
  {
    value: "ROUND_ROBIN",
    label: "Round Robin",
    description: "Every player plays against every other player once",
  },
  {
    value: "LEAGUE",
    label: "League",
    description: "Round robin with points system (win/draw/loss)",
  },
  {
    value: "SINGLE_ELIMINATION",
    label: "Single Elimination",
    description: "Lose once and you're out",
  },
  {
    value: "DOUBLE_ELIMINATION",
    label: "Double Elimination",
    description: "Need to lose twice to be eliminated",
  },
  {
    value: "SWISS",
    label: "Swiss",
    description: "Players with similar records face each other each round",
  },
];

// Whether a phase type supports multiple groups
const SUPPORTS_GROUPS: Record<PhaseType, boolean> = {
  ROUND_ROBIN: true,
  LEAGUE: true,
  SINGLE_ELIMINATION: false,
  DOUBLE_ELIMINATION: false,
  SWISS: false,
};

// Whether a phase type supports points config
const SUPPORTS_POINTS: Record<PhaseType, boolean> = {
  ROUND_ROBIN: false,
  LEAGUE: true,
  SINGLE_ELIMINATION: false,
  DOUBLE_ELIMINATION: false,
  SWISS: false,
};

// =============================================================================
// NEW PHASE PAGE
// =============================================================================

export default function NewPhasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  // Basic fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState(1);
  const [type, setType] = useState<PhaseType>("ROUND_ROBIN");

  // Config fields
  const [matchGeneration, setMatchGeneration] = useState<MatchGeneration>("auto");
  const [seeding, setSeeding] = useState<Seeding>("random");
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

  function buildConfig() {
    const base = {
      matchGeneration,
      seeding,
      bestOf,
      advanceTopN,
    };

    if (type === "ROUND_ROBIN" || type === "LEAGUE") {
      return {
        ...base,
        groups,
        ...(type === "LEAGUE" && { pointsWin, pointsDraw, pointsLoss }),
      };
    }

    if (type === "SINGLE_ELIMINATION") {
      return { ...base, thirdPlaceMatch };
    }

    if (type === "SWISS") {
      return { ...base, rounds };
    }

    return base;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await api.post(`/tournaments/${id}/phases`, {
        name,
        description: description.trim() || undefined,
        order,
        type,
        config: buildConfig(),
      });

      toast.success("Phase created!");
      router.push(`/tournaments/${id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.code) {
          case "ORDER_TAKEN":
            setError(`A phase with order ${order} already exists.`);
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

  const selectedTypeInfo = PHASE_TYPE_OPTIONS.find((t) => t.value === type);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/tournaments/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Phase</h1>
          <p className="text-muted-foreground text-sm">
            Add a phase to the tournament
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
                placeholder="e.g. Group Stage, Quarter Finals"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order">Phase order</Label>
              <Input
                id="order"
                type="number"
                min={1}
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                The order in which this phase runs. Phase 1 runs first.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Phase type */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Phase Type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              {PHASE_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value)}
                  className={`flex flex-col items-start p-3 rounded-lg border text-left transition-colors ${
                    type === option.value
                      ? "border-primary bg-primary/5"
                      : "hover:bg-accent"
                  }`}
                >
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">
                    {option.description}
                  </span>
                </button>
              ))}
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
                  Matches are created automatically when the phase starts
                </p>
              </div>
              <Switch
                checked={matchGeneration === "auto"}
                onCheckedChange={(v) =>
                  setMatchGeneration(v ? "auto" : "manual")
                }
              />
            </div>

            {matchGeneration === "auto" && (
              <div className="space-y-2">
                <Label>Seeding</Label>
                <Select
                  value={seeding}
                  onValueChange={(v) => setSeeding(v as Seeding)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Random</SelectItem>
                    <SelectItem value="by_seed">
                      By seed number (from participant seed)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Groups — only for ROUND_ROBIN and LEAGUE */}
        {SUPPORTS_GROUPS[type] && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Groups</CardTitle>
              <CardDescription>
                Split participants into multiple groups that play within
                themselves
              </CardDescription>
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
                <p className="text-xs text-muted-foreground">
                  Players are distributed evenly using snake seeding.
                  {groups > 1 &&
                    ` Groups will be named A through ${String.fromCharCode(
                      64 + groups
                    )}.`}
                </p>
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
                <p className="text-xs text-muted-foreground">
                  How many players from each group advance to the next phase.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Points system — only for LEAGUE */}
        {SUPPORTS_POINTS[type] && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Points System</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

        {/* Best of — for elimination types */}
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
                      Play a match between the two semi-final losers
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
                  <p className="text-xs text-muted-foreground">
                    Recommended: log₂(players) rounds
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || !name}
        >
          {isSubmitting ? "Creating..." : "Create Phase"}
        </Button>
      </form>
    </div>
  );
}
