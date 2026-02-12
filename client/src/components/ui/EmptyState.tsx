'use client';
import WoodButton from './WoodButton';

interface Props {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; href: string };
}

const PRESETS = {
  sessions: {
    icon: '🕸️',
    title: 'The quest board is bare...',
    description: 'No sessions are posted. The tavern keeper says new quests arrive regularly. Check back soon, adventurer.',
  },
  characters: {
    icon: '📜',
    title: 'Your character sheet is blank',
    description: 'Every legendary hero started somewhere. Create your first character to begin your journey.',
  },
  recaps: {
    icon: '🪶',
    title: "The chronicler's quill lies still...",
    description: 'No tales have been recorded yet. After your first adventure, the DM will inscribe the story here.',
  },
  messages: {
    icon: '🦅',
    title: 'The messenger raven returns empty-taloned',
    description: 'No messages await you. Send a raven to a fellow adventurer to start a conversation.',
  },
  quests: {
    icon: '🗺️',
    title: 'No quests in your log',
    description: "You haven't joined any adventures yet. Browse the quest board and sign up for your first session!",
  },
  discussions: {
    icon: '🍺',
    title: 'The tavern is quiet tonight...',
    description: 'No discussions yet. Pull up a chair and start a conversation with your fellow adventurers.',
  },
  downtime: {
    icon: '🏕️',
    title: 'Camp is peaceful',
    description: "No downtime actions submitted yet. Between adventures, your character can craft, train, research, or explore.",
  },
} as const;

export type EmptyStatePreset = keyof typeof PRESETS;

export function EmptyStateFromPreset({ preset, action }: { preset: EmptyStatePreset; action?: { label: string; href: string } }) {
  const p = PRESETS[preset];
  return <EmptyState icon={p.icon} title={p.title} description={p.description} action={action} />;
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="parchment p-10 text-center">
      <div className="text-5xl mb-4 opacity-60">{icon}</div>
      <h2 className="font-[var(--font-heading)] text-xl text-[var(--ink)] mb-2">{title}</h2>
      <p className="text-[var(--ink-faded)] italic max-w-md mx-auto">{description}</p>
      {action && (
        <WoodButton variant="primary" href={action.href} className="mt-4">{action.label}</WoodButton>
      )}
    </div>
  );
}
