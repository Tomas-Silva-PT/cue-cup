"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

// =============================================================================
// TYPES
// =============================================================================

interface Player {
  id: string;
  nickname: string;
  bio: string | null;
}

// =============================================================================
// EDIT PROFILE PAGE
// =============================================================================

const fetcher = (url: string) => api.get<any>(url);

export default function EditProfilePage() {
  const router = useRouter();

  const { data: player, mutate } = useSWR<Player>("/players/me", fetcher);

  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form once player data loads
  useEffect(() => {
    if (player) {
      setNickname(player.nickname);
      setBio(player.bio ?? "");
    }
  }, [player]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await api.patch("/players/me", {
        nickname: nickname.trim(),
        bio: bio.trim() || undefined,
      });

      // Revalidate the player cache so the sidebar updates immediately
      await mutate();

      toast.success("Profile updated!");
      router.push("/profile");
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.code) {
          case "NICKNAME_TAKEN":
            setError("This nickname is already taken.");
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
          <Link href="/profile">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Profile</h1>
          <p className="text-muted-foreground text-sm">
            Update your public profile
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Profile Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                minLength={3}
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">
                3-30 characters. This is how other players see you.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell others about yourself..."
                maxLength={500}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {bio.length}/500
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            asChild
          >
            <Link href="/profile">Cancel</Link>
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={isSubmitting || !nickname.trim()}
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
