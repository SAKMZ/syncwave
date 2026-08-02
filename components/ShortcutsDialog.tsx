"use client";

import { Keyboard } from "lucide-react";
import { SHORTCUTS, type Shortcut } from "@/lib/shortcuts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

const GROUPS: Shortcut["group"][] = ["Playback", "Navigate", "Room"];

/**
 * The shortcut list, read from the same table the handlers are read from — so
 * a binding cannot be documented here and missing from the room, which is the
 * usual fate of a help dialog.
 */
export default function ShortcutsDialog({
  open,
  onOpenChange,
  isHost,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isHost: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="shortcuts-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-ink">
            <Keyboard className="size-4 text-[var(--accent-2)]" /> Keyboard shortcuts
          </DialogTitle>
          <DialogDescription id="shortcuts-desc" className="text-muted">
            {isHost
              ? "You're hosting, so the playback keys are yours."
              : "Playback keys belong to the host — the rest work for everyone."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          {GROUPS.map((group) => {
            const rows = SHORTCUTS.filter((s) => s.group === group);
            if (!rows.length) return null;
            return (
              <section key={group}>
                <h3 className="sw-label mb-2">{group}</h3>
                <dl className="grid gap-1">
                  {rows.map((s) => (
                    <div
                      key={s.id}
                      className="sw-row flex items-center justify-between gap-4 px-2 py-1.5"
                    >
                      <dt className="text-sm text-ink-soft">
                        {s.label}
                        {s.hostOnly && !isHost && (
                          <span className="ml-2 text-[10px] tracking-[0.14em] text-muted uppercase">
                            host only
                          </span>
                        )}
                      </dt>
                      <dd className="flex shrink-0 items-center gap-1">
                        {s.keys.map((k) => (
                          <Kbd key={k} className="rounded-sm">
                            {k}
                          </Kbd>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
