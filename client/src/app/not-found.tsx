import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="parchment p-10 text-center max-w-lg mx-auto mt-10">
      <div className="text-6xl mb-4">🗺️</div>
      <h1 className="font-[var(--font-heading)] text-3xl text-[var(--ink)] mb-3">
        Page Not Found
      </h1>
      <p className="text-[var(--ink-faded)] mb-2">
        You&apos;ve wandered off the map, adventurer. This path leads nowhere.
      </p>
      <p className="text-[var(--ink-faded)] italic text-sm mb-6">
        Roll a d20 Survival check to find your way back...
      </p>
      <Link href="/" className="wood-btn wood-btn-primary no-underline inline-block">
        ⚔️ Return to Quest Board
      </Link>
    </div>
  );
}
