"use client";

import { KidAvatar } from "./KidAvatar";

export type SendContact = {
  id: string;
  label: string;
  avatarId: string;
  /** Ready-to-render, e.g. "$3.00 left this week". */
  weeklyLeftDisplay?: string;
};

/** Step one of Send: a grid of faces from the kid's list, plus a way to ask for someone new. */
export function ContactGrid({
  contacts,
  onPick,
  onAskToAdd,
  showAskToAdd = true,
  intro = "Only people on your list. That keeps your money safe.",
}: {
  contacts: SendContact[];
  onPick: (id: string) => void;
  onAskToAdd?: () => void;
  /** The share jar has no ask tile: a share goes to someone already on the list. */
  showAskToAdd?: boolean;
  intro?: string;
}) {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-[30px] font-semibold leading-9 text-kid-green">Who gets it?</h1>
        <p className="text-base text-ink/70">{intro}</p>
      </header>

      <ul className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4" role="list">
        {contacts.map((contact) => {
          const describedBy = contact.weeklyLeftDisplay ? `send-contact-${contact.id}-left` : undefined;
          return (
            <li key={contact.id} className="flex justify-center">
              <button
                type="button"
                aria-label={contact.label}
                aria-describedby={describedBy}
                onClick={() => onPick(contact.id)}
                className="group flex w-full min-w-[88px] flex-col items-center gap-2 rounded-3xl px-2 py-3 transition-transform duration-200 ease-out hover:bg-white/60 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50 motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <KidAvatar avatarId={contact.avatarId} label={contact.label} className="transition-transform duration-200 ease-out group-hover:-translate-y-0.5 motion-reduce:transform-none" />
                <span className="text-center text-base font-semibold leading-5 text-ink">{contact.label}</span>
                {contact.weeklyLeftDisplay && (
                  <span id={describedBy} className="text-center text-xs font-medium leading-4 text-ink/55 tabular-nums">
                    {contact.weeklyLeftDisplay}
                  </span>
                )}
              </button>
            </li>
          );
        })}

        {showAskToAdd && (
        <li className="flex justify-center">
          <button
            type="button"
            onClick={onAskToAdd}
            className="flex w-full min-w-[88px] flex-col items-center gap-2 rounded-3xl px-2 py-3 transition-transform duration-200 ease-out hover:bg-white/60 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <span
              aria-hidden="true"
              className="inline-flex size-[72px] items-center justify-center rounded-full border-[3px] border-dashed border-kid-teal/60 bg-transparent text-4xl font-semibold leading-none text-kid-teal"
            >
              +
            </span>
            <span className="text-center text-base font-semibold leading-5 text-kid-teal">Ask to add someone</span>
          </button>
        </li>
        )}
      </ul>
    </section>
  );
}
