"use client";

/**
 * ============================================================================
 * SLASH COMMANDS — Popover type Discord/Slack/Yeshua Connect pour Helm Connect
 * ============================================================================
 *
 * ⭐ V1 (porté de Yeshua Connect — 14/10/2026) :
 *    Affiche une liste filtrée de commandes slash au-dessus du composer quand
 *    l'utilisateur tape "/". Navigation clavier (↑/↓/Enter/Échap), clic souris,
 *    filtrage par préfixe, et rappel du usage quand des args sont détectés.
 *
 * Commands disponibles dans Helm Connect :
 *   /me <action>          — Italique (action à la 3e personne)
 *   /shrug [texte]        — Ajoute ¯\_(ツ)_/¯
 *   /tableflip [texte]    — Ajoute (╯°□°)╯︵ ┻━┻
 *   /unflip [texte]       — Ajoute ┬─┬ ノ( ゜-゜ノ)
 *   /lenny [texte]        — Ajoute ( ͡° ͜ʖ ͡°)
 *   /spoiler <texte>      — Wrap dans ||texte||
 *   /code <texte>         — Wrap dans `texte`
 *   /poll <question>      — Ouvre le modal de sondage
 *   /announce <texte>    — Ouvre le modal d'annonce
 *   /clear                — Vide l'écran de chat (local)
 *   /help                 — Afficher l'aide
 *
 * Usage dans WhatsAppChat :
 *   <SlashCommandsPopover
 *     input={text}
 *     onCommand={(cmd, args) => { ... }}
 *     onDismiss={() => ...}
 *   />
 *
 * Le caller (WhatsAppChat) garde son `parseSlashCommand` existant pour exécuter
 * les commandes sélectionnées — ce composant ne fait QUE l'affichage et la
 * navigation.
 * ============================================================================
 */

import { useState, useEffect, useRef, useMemo } from "react";

export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  icon: string;
}

export const HELM_COMMANDS: SlashCommand[] = [
  { name: "me", description: "Action à la 3e personne (italique)", usage: "/me fait un signe", icon: "🎬" },
  { name: "shrug", description: "Ajoute ¯\\_(ツ)_/¯", usage: "/shrug ou /shrug bah", icon: "🤷" },
  { name: "tableflip", description: "Ajoute (╯°□°)╯︵ ┻━┻", usage: "/tableflip ou /tableflip non!", icon: "💥" },
  { name: "unflip", description: "Ajoute ┬─┬ ノ( ゜-゜ノ)", usage: "/unflip", icon: "🧘" },
  { name: "lenny", description: "Ajoute ( ͡° ͜ʖ ͡°)", usage: "/lenny", icon: "😏" },
  { name: "spoiler", description: "Wrap le texte en spoiler ||...||", usage: "/spoiler La fin du film", icon: "🎭" },
  { name: "code", description: "Wrap le texte en `code inline`", usage: "/code const x = 42", icon: "💻" },
  { name: "poll", description: "Créer un sondage", usage: "/poll Quelle date vous convient ?", icon: "📊" },
  { name: "announce", description: "Publier une annonce officielle", usage: "/announce Message important", icon: "📢" },
  { name: "clear", description: "Vider l'écran de chat (local)", usage: "/clear", icon: "🧹" },
  { name: "help", description: "Afficher l'aide des commandes", usage: "/help", icon: "❓" },
];

interface SlashCommandsPopoverProps {
  input: string;
  onCommand: (command: string, args: string) => void;
  onDismiss: () => void;
}

export function SlashCommandsPopover({ input, onCommand, onDismiss }: SlashCommandsPopoverProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extraire le nom de la commande (sans le /) et les args éventuels
  const { cmdName, args } = useMemo(() => parseInput(input), [input]);

  // ⭐ Calcul dérivé (useMemo) plutôt que state + effect — évite les cascading renders
  const filteredCommands = useMemo<SlashCommand[]>(() => {
    if (!input.startsWith("/")) return [];
    if (!args) {
      return HELM_COMMANDS.filter((c) => c.name.startsWith(cmdName));
    }
    // Une fois qu'on a un espace + des args, on montre juste la commande
    // sélectionnée (pour rappeler le usage)
    const cmd = HELM_COMMANDS.find((c) => c.name === cmdName);
    return cmd ? [cmd] : [];
  }, [input, cmdName, args]);

  // Clamper selectedIndex dans les bornes de la liste filtrée
  const safeSelectedIndex = filteredCommands.length === 0
    ? 0
    : Math.min(selectedIndex, filteredCommands.length - 1);

  // Dismiss automatique quand l'input ne matche plus
  useEffect(() => {
    if (!input.startsWith("/") || filteredCommands.length === 0) {
      onDismiss();
    }
  }, [input, filteredCommands.length, onDismiss]);

  // Reset selectedIndex quand la liste filtrée change
  useEffect(() => {
    setSelectedIndex(0);
  }, [cmdName]);

  // Navigation clavier : ↑/↓ pour changer, Entrée pour valider, Échap pour fermer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (filteredCommands.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === "Enter") {
        // On n'empêche pas le Enter global — le caller gère l'envoi. Mais si
        // une commande est sélectionnée et qu'on tape Entrée alors qu'il n'y
        // a pas encore d'args, on déclenche la commande.
        const cmd = filteredCommands[safeSelectedIndex];
        if (cmd && !args) {
          e.preventDefault();
          onCommand(cmd.name, "");
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filteredCommands, safeSelectedIndex, args, onCommand, onDismiss]);

  if (filteredCommands.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 max-w-md"
    >
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
          Commandes slash
        </p>
        <p className="text-[10px] text-slate-400">
          ↑↓ naviguer · Entrée valider · Échap fermer
        </p>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {filteredCommands.map((cmd, i) => (
          <button
            key={cmd.name}
            onClick={() => onCommand(cmd.name, args)}
            onMouseEnter={() => setSelectedIndex(i)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
              i === safeSelectedIndex ? "bg-blue-50" : "hover:bg-slate-50"
            }`}
          >
            <span className="text-xl flex-shrink-0">{cmd.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">/{cmd.name}</p>
              <p className="text-xs text-slate-500 truncate">{cmd.description}</p>
            </div>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline flex-shrink-0">
              {cmd.usage}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Parse "/poll question ?" → { cmdName: "poll", args: "question ?" } */
function parseInput(input: string): { cmdName: string; args: string } {
  if (!input.startsWith("/")) return { cmdName: "", args: "" };
  const trimmed = input.substring(1);
  // Strip HTML tags (the RichTextEditor produces HTML)
  const clean = trimmed.replace(/<[^>]*>/g, "");
  const spaceIdx = clean.indexOf(" ");
  if (spaceIdx === -1) return { cmdName: clean.toLowerCase(), args: "" };
  return {
    cmdName: clean.substring(0, spaceIdx).toLowerCase(),
    args: clean.substring(spaceIdx + 1).trim(),
  };
}
