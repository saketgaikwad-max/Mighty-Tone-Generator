import { Guitar, Music, RefreshCw, Rocket, Save, Settings, Timer, Waves } from 'lucide-react';
import { useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

// ── Use-case chip data ─────────────────────────────────────────────────────

const USE_CASES = [
  { label: 'Clean / sparkly', prompt: 'bright Fender clean, single coil, headphones' },
  { label: 'Edge of breakup', prompt: 'low gain crunch, bluesy, warm' },
  { label: 'Classic crunch', prompt: 'AC/DC crunch, bridge humbucker, tight' },
  { label: 'Modern lead', prompt: 'high gain lead, singing sustain, smooth mids' },
  { label: 'Acoustic sim', prompt: 'acoustic piezo, dreadnought body warmth, no chorus' },
  { label: 'Mandolin electric', prompt: 'bright mandolin, clean with light compression' },
  { label: 'Shoegaze wall', prompt: 'massive reverb, clean amp, modulation heavy' },
  { label: 'Bedroom practice', prompt: 'low volume, headphones, balanced clean' },
];

// ── Step number badge ──────────────────────────────────────────────────────

function StepBadge({ n }: { n: number }) {
  return (
    <span
      className="flex-shrink-0 flex items-center justify-center rounded-full text-white text-[13px] font-bold"
      style={{
        width: 28,
        height: 28,
        background: 'linear-gradient(135deg, #7C6CFF 0%, #4F8BFF 100%)',
      }}
    >
      {n}
    </span>
  );
}

// ── Use-case chip ──────────────────────────────────────────────────────────

function UseCaseChip({
  label,
  prompt,
  onCopy,
}: {
  label: string;
  prompt: string;
  onCopy: (text: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(prompt)}
      className="text-left w-full rounded-xl px-3 py-2.5 border border-white/[0.08]"
      style={{ background: '#141826', minHeight: 44 }}
    >
      <p className="text-[12px] font-semibold" style={{ color: '#F2F3F8' }}>
        {label}
      </p>
      <p className="text-[12px] mt-0.5 italic" style={{ color: '#9AA0B8' }}>
        "{prompt}"
      </p>
    </button>
  );
}

// ── Collapsible section card ────────────────────────────────────────────────

function SectionCard({
  section,
  open,
  onToggle,
}: {
  section: Section;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="rounded-[18px] border border-white/[0.08] shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden"
      style={{ background: 'rgba(28,32,52,0.62)', backdropFilter: 'blur(24px)' }}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-3 w-full px-4 text-left"
        style={{ minHeight: 52 }}
      >
        <span className="text-[22px] leading-none">{section.icon}</span>
        <span className="flex-1 text-[16px] font-semibold" style={{ color: '#F2F3F8' }}>
          {section.title}
        </span>
        <span className="text-[20px] leading-none" style={{ color: '#9AA0B8' }}>
          {open ? '∨' : '›'}
        </span>
      </button>

      {/* Expandable content */}
      {open && (
        <div className="px-4 pb-5 pt-1 border-t border-white/[0.06]">
          {section.content}
        </div>
      )}
    </div>
  );
}

// ── Main Help screen ───────────────────────────────────────────────────────

export function Help() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'first-steps': true,
  });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggleSection(id: string) {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function copyPrompt(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast('Copied!');
    toastTimer.current = setTimeout(() => setToast(null), 1500);
  }

  const sections: Section[] = [
    {
      id: 'first-steps',
      icon: <Rocket size={20} className="inline" style={{ color: '#7C6CFF' }} />,
      title: 'First steps',
      content: (
        <ol className="flex flex-col gap-3 mt-3">
          {[
            <>Open <strong>Profile</strong> tab → add your instruments (guitar/mandolin model, pickup type)</>,
            <>In Profile → <strong>AI engine</strong>: enter your Gemini API key (free at aistudio.google.com) for smart tone suggestions. Skip this to use the copy-paste AI handoff instead.</>,
            <>In Profile → set your <strong>default instrument</strong> so every new session starts with the right pickup.</>,
            <>Tap <strong>Sessions</strong> → "＋ New session" → name it, pick your instrument and context (headphones / band mix).</>,
            <>Type a tone description and tap Send. Scan the QR code in MightyAmp on your phone.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-3 items-start">
              <StepBadge n={i + 1} />
              <span className="text-[14px] leading-snug pt-0.5" style={{ color: '#F2F3F8' }}>{step}</span>
            </li>
          ))}
        </ol>
      ),
    },
    {
      id: 'first-tone',
      icon: <Guitar size={20} className="inline" style={{ color: '#7C6CFF' }} />,
      title: 'Creating your first tone',
      content: (
        <ol className="flex flex-col gap-3 mt-3">
          {[
            <>Tap the Sessions tab and press <strong>＋ New session</strong>.</>,
            <>Name the session (e.g. "Practice blues licks") and select your guitar and pickup position.</>,
            <>Type a tone description in plain English. Examples: <em>"warm Fender clean with a hint of chorus"</em>, <em>"modern hi-gain crunch, tight lows"</em>, <em>"Opeth-style dark clean, sparkly highs"</em>.</>,
            <>The app generates a patch. A <strong>QR code</strong> appears — open <strong>MightyAmp</strong> on your phone and use the QR import button to load the patch directly.</>,
            <>Not quite right? Type feedback: <em>"less reverb"</em>, <em>"brighter"</em>, <em>"too muddy"</em>. Or tap <strong>Give feedback</strong> for quick-tag chips.</>,
            <>Tap <strong>Save</strong> to keep the tone in your library.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-3 items-start">
              <StepBadge n={i + 1} />
              <span className="text-[14px] leading-snug pt-0.5" style={{ color: '#F2F3F8' }}>{step}</span>
            </li>
          ))}
        </ol>
      ),
    },
    {
      id: 'use-cases',
      icon: <Music size={20} className="inline" style={{ color: '#7C6CFF' }} />,
      title: 'Tone use cases',
      content: (
        <div className="mt-3 flex flex-col gap-2">
          {USE_CASES.map(uc => (
            <UseCaseChip key={uc.label} label={uc.label} prompt={uc.prompt} onCopy={copyPrompt} />
          ))}
          <p className="text-[13px] mt-2" style={{ color: '#9AA0B8' }}>
            Paste any of these as your first prompt, then adjust from there.
          </p>
        </div>
      ),
    },
    {
      id: 'feedback',
      icon: <RefreshCw size={20} className="inline" style={{ color: '#7C6CFF' }} />,
      title: 'Feedback and variants',
      content: (
        <ul className="flex flex-col gap-3 mt-3">
          {[
            <>After generating a tone, tap <strong>Give feedback</strong> to open the feedback sheet.</>,
            <>Select quick-tag chips (Muddy, Harsh, Too wet, etc.) or type freeform.</>,
            <>Set <strong>Want options</strong> to 2–5 to get multiple variant QR codes at once (Darker, Balanced, Brighter).</>,
            <>Use <strong>Lock blocks</strong> to freeze parts of the signal chain you like (e.g. lock the Amp so only effects change).</>,
            <>Each generation creates a new <strong>version</strong> — tap ▼ History to see the full timeline and restore any previous patch.</>,
          ].map((item, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#7C6CFF' }} />
              <span className="text-[14px] leading-snug" style={{ color: '#F2F3F8' }}>{item}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'delay',
      icon: <Timer size={20} className="inline" style={{ color: '#7C6CFF' }} />,
      title: 'Delay helper',
      content: (
        <ul className="flex flex-col gap-3 mt-3">
          {[
            <>Tap <strong>⏱ Delay helper</strong> on any response card.</>,
            <>Select delay type (Analog, Digital, Tape…).</>,
            <>Enter your song's BPM or tap <strong>Tap ●</strong> in rhythm to auto-detect it.</>,
            <>Choose note division (1/4, dotted 1/8, 1/8, triplet).</>,
            <>The app calculates the nearest device value and shows the exact milliseconds.</>,
            <>Tap <strong>Apply</strong> to update the patch and get a new QR.</>,
          ].map((item, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#7C6CFF' }} />
              <span className="text-[14px] leading-snug" style={{ color: '#F2F3F8' }}>{item}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'profile',
      icon: <Settings size={20} className="inline" style={{ color: '#7C6CFF' }} />,
      title: 'Profile and settings',
      content: (
        <ul className="flex flex-col gap-3 mt-3">
          {[
            <><strong>Instruments</strong>: Add each guitar/mandolin you own. The app uses the pickup type for tone corrections.</>,
            <><strong>Gemini API key</strong>: Get a free key at aistudio.google.com. Paste it here to enable on-device AI suggestions.</>,
            <><strong>Default instrument</strong>: Pre-selects an instrument for every new session.</>,
            <><strong>Backup</strong>: Export all your sessions, tones, and versions as a <code>.json</code> file. Import to restore on another device.</>,
          ].map((item, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#7C6CFF' }} />
              <span className="text-[14px] leading-snug" style={{ color: '#F2F3F8' }}>{item}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'ir',
      icon: <Waves size={20} className="inline" style={{ color: '#7C6CFF' }} />,
      title: 'Using IRs (Impulse Responses)',
      content: (
        <ul className="flex flex-col gap-3 mt-3">
          {[
            <>The NUX Mighty Space supports <strong>20 user IR slots</strong> (slots 35–54).</>,
            <>Tap the <strong>IR Lab</strong> tab → <strong>Slots</strong> to see your inventory.</>,
            <>To load a new IR: tap <strong>Prep tool</strong>, drop in a <code>.wav</code> file, configure (min-phase, trim, normalise), check the frequency response preview, then assign to a slot number.</>,
            <>Load the prepared WAV into MightyAmp's IR slot manually (file transfer via the MightyAmp app).</>,
            <>When the engine suggests an acoustic IR tone, it references the slot number in the QR — MightyAmp loads it automatically.</>,
          ].map((item, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#7C6CFF' }} />
              <span className="text-[14px] leading-snug" style={{ color: '#F2F3F8' }}>{item}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'saving',
      icon: <Save size={20} className="inline" style={{ color: '#7C6CFF' }} />,
      title: 'Saving and backup',
      content: (
        <ul className="flex flex-col gap-3 mt-3">
          {[
            <>Tap <strong>Save</strong> on any response card to add the tone to your Saved Tones library.</>,
            <>The <strong>Saved Tones</strong> tab shows all saved tones with artwork, searchable and filterable by archetype and instrument.</>,
            <>To back up: Profile → Data → <strong>Back up now</strong> — saves a <code>.json</code> file locally.</>,
            <>To restore: Profile → Data → <strong>Import…</strong> — select the <code>.json</code> file.</>,
            <>Data is stored entirely on your device. There is no cloud sync.</>,
          ].map((item, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#7C6CFF' }} />
              <span className="text-[14px] leading-snug" style={{ color: '#F2F3F8' }}>{item}</span>
            </li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <div className="relative h-full flex flex-col" style={{ background: '#0B0D14' }}>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 pb-8">
        {/* Header */}
        <div className="pt-safe pb-6">
          <h1 className="text-[34px] font-bold leading-tight" style={{ color: '#F2F3F8' }}>
            Guide
          </h1>
          <p className="text-[15px] mt-1" style={{ color: '#9AA0B8' }}>
            Mighty Tone Generator
          </p>
        </div>

        {/* Section label */}
        <p
          className="text-[12px] uppercase tracking-wider mb-3"
          style={{ color: '#62677E' }}
        >
          Quick start
        </p>

        {/* Sections */}
        <div className="flex flex-col gap-3">
          {sections.map(section => (
            <SectionCard
              key={section.id}
              section={section}
              open={!!openSections[section.id]}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full text-[14px] font-semibold text-white pointer-events-none z-50"
          style={{ background: 'rgba(124,108,255,0.92)', backdropFilter: 'blur(12px)' }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
