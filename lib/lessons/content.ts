/**
 * Learn lesson content. Written for a kid to read alone: short sentences,
 * no jargon, no fear framing. Edventures Wallet has no passwords, so that word never
 * appears here — see docs/design/EDVENTURES-WALLET-UI-SPEC.md section 12.
 */

export type LessonStep = {
  heading: string;
  body: string;
};

export type LessonQuestion = {
  prompt: string;
  /** Always exactly three. */
  options: string[];
  /** Index into options. */
  correctIndex: number;
  explain: string;
};

export type Lesson = {
  id: string;
  title: string;
  minutes: number;
  /** Always exactly three. */
  steps: LessonStep[];
  question: LessonQuestion;
};

export const LESSONS: Lesson[] = [
  {
    id: "before-you-send",
    title: "Before you send",
    minutes: 3,
    steps: [
      {
        heading: "Check the person",
        body: "Only people on your list can get money from you. A name on your list is someone a parent added.",
      },
      {
        heading: "Check the amount",
        body: "Your limit is there so one mistake can't take everything. If it's more than your limit, it waits for a parent.",
      },
      {
        heading: "Check twice, then tap",
        body: "Once money is sent, it's gone. Nobody real will rush you.",
      },
    ],
    question: {
      prompt: "A message says: send $5 now and I'll send you $10 back. What do you do?",
      options: ["Send the $5 right away", "Don't send it, and tell a parent", "Send $5 but ask them to hurry"],
      correctIndex: 1,
      explain: "Nobody real pays you back double for money you send first. Telling a parent is always the right move.",
    },
  },
  {
    id: "spot-a-scam",
    title: "Spot a scam",
    minutes: 3,
    steps: [
      {
        heading: "A stranger asks for money",
        body: "You don't really know this person. A real friend never asks you to send them money.",
      },
      {
        heading: "A promise of free money",
        body: "Nobody hands out free money for nothing. If it sounds too good to be true, it is.",
      },
      {
        heading: "Hurry or a secret",
        body: "They want you to act fast or keep it just between you two. That's a sign something is wrong.",
      },
    ],
    question: {
      prompt: "A friend from your game asks you to send them a gift card code so you both get bonus coins. What do you do?",
      options: ["Send the code right away", "Say no, and tell a parent", "Ask them to send their code to you first"],
      correctIndex: 1,
      explain: "A real friend from a game would never need your gift card code. Saying no and telling a parent is always okay.",
    },
  },
];

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}
