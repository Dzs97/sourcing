"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Entry, Status } from "@/lib/types";

interface Command {
  id: string;
  label: string;
  kind: string;
  action: () => void;
}

export default function CommandPalette({
  open,
  onClose,
  entries,
  onNavigate,
  onChangeStatus,
}: {
  open: boolean;
  onClose: () => void;
  entries: Entry[];
  onNavigate: (tab: "tracker" | "rankings" | "matrix") => void;
  onChangeStatus: (id: string, status: Status) => Promise<void> | void;
}) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      // Focus the input after the modal paints
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      {
        id: "tab-tracker",
        label: "Go to Tracker",
        kind: "nav",
        action: () => {
          onNavigate("tracker");
          onClose();
        },
      },
      {
        id: "tab-rankings",
        label: "Go to Rankings",
        kind: "nav",
        action: () => {
          onNavigate("rankings");
          onClose();
        },
      },
      {
        id: "tab-matrix",
        label: "Go to Matrix",
        kind: "nav",
        action: () => {
          onNavigate("matrix");
          onClose();
        },
      },
    ];
    // Entry search — cap at 40 hits to keep the palette snappy
    const qq = q.trim().toLowerCase();
    if (qq) {
      const hits = entries
        .filter((e) => e.name.toLowerCase().includes(qq))
        .slice(0, 40);
      for (const e of hits) {
        list.push({
          id: `entry-${e.id}`,
          label: e.name,
          kind: `${e.domain} · ${e.status}`,
          action: () => {
            // Land on tracker, filtered to show this entry via search
            onNavigate("tracker");
            const url = new URL(window.location.href);
            url.searchParams.set("q", e.name);
            window.history.replaceState({}, "", url.toString());
            window.location.reload();
          },
        });
      }
    }
    return list;
  }, [q, entries, onNavigate, onClose]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(qq));
  }, [commands, q]);

  useEffect(() => {
    if (cursor >= filtered.length) setCursor(0);
  }, [filtered, cursor]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(filtered.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[cursor]?.action();
    }
  }

  if (!open) return null;

  return (
    <div
      className="palette-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette" role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Type to search entries or jump to a tab…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="palette-results">
          {filtered.length === 0 ? (
            <div className="palette-empty">No matches</div>
          ) : (
            filtered.map((c, i) => (
              <div
                key={c.id}
                className="palette-item"
                aria-selected={i === cursor}
                onMouseEnter={() => setCursor(i)}
                onClick={() => c.action()}
              >
                <span>{c.label}</span>
                <span className="palette-item-kind">{c.kind}</span>
              </div>
            ))
          )}
        </div>
        <div className="palette-hint">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
