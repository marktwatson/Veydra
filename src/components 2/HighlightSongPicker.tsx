import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Music, Plus, Trash2 } from "lucide-react";

export type HighlightSong = {
  title: string;
  artist: string;
  link: string;
  moment: string;
};

type Props = {
  songs: HighlightSong[];
  onChange: (songs: HighlightSong[]) => void;
  /** When true, shows the empty-state hint styled for an inline (questionnaire) placement. */
  inline?: boolean;
};

/**
 * Reusable highlight-video song picker. Used both inside the Bride Portal
 * questionnaire (Photo & Video step, when the package includes video) and on
 * the dedicated Songs tab.
 */
export function HighlightSongPicker({ songs, onChange, inline }: Props) {
  const update = (index: number, patch: Partial<HighlightSong>) => {
    const next = [...songs];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const remove = (index: number) => {
    const next = [...songs];
    next.splice(index, 1);
    onChange(next);
  };

  const add = () =>
    onChange([...songs, { title: "", artist: "", link: "", moment: "" }]);

  return (
    <div className="space-y-4">
      {songs.length === 0 && (
        <div
          className={`text-center py-6 px-4 bg-[#faf7f2] rounded-xl border border-dashed border-[#c9a96e]/40 ${
            inline ? "" : "py-8"
          }`}
        >
          <Music
            className={`text-[#1a1a1a]/40 mx-auto mb-2 ${
              inline ? "h-8 w-8" : "h-10 w-10"
            }`}
          />
          <p className="text-sm text-[#1a1a1a]/60">
            No songs added yet. Click below to add your first song.
          </p>
        </div>
      )}

      {songs.map((song, index) => (
        <div
          key={index}
          className="bg-[#faf7f2] p-4 rounded-xl border border-[#c9a96e]/20 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#1a1a1a]/60">
              Song {index + 1}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive shrink-0"
              onClick={() => remove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Song Title</Label>
              <Input
                placeholder="e.g., Perfect"
                value={song.title}
                onChange={(e) => update(index, { title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Artist</Label>
              <Input
                placeholder="e.g., Ed Sheeran"
                value={song.artist}
                onChange={(e) => update(index, { artist: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Link (optional)</Label>
              <Input
                placeholder="Spotify, YouTube, or Apple Music link"
                value={song.link}
                onChange={(e) => update(index, { link: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Which moment? (optional)</Label>
              <Input
                placeholder="First dance, ceremony entrance, full highlight"
                value={song.moment}
                onChange={(e) => update(index, { moment: e.target.value })}
              />
            </div>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-[#1a1a1a]/30 text-[#1a1a1a] hover:bg-[#c9a96e]/15"
        onClick={add}
      >
        <Plus className="h-4 w-4 mr-2" /> Add Song
      </Button>
    </div>
  );
}
