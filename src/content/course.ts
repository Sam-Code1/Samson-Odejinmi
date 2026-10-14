import data from "./blender-foundations.json";

export type Currency = "NGN" | "USD" | "GBP";
export type PriceRow = { currency: Currency; amountMinor: number };

/**
 * Fallback pricing used when Supabase isn't configured or has no rows.
 * The source of truth is the `course_pricing` table. Amounts are in minor units
 * (kobo / cents), so ₦25,000 = 2_500_000 and $30 = 3_000.
 */
export const defaultPricing: PriceRow[] = [
  { currency: "NGN", amountMinor: 2_500_000 },
  { currency: "USD", amountMinor: 3_000 },
];

export const course = {
  ...data,
  moduleCount: data.modules.length,
  lessonCount: data.modules.reduce((n, m) => n + m.lessons.length, 0),
  format: "Self-paced",
  access: "One-time payment, lifetime access",
  audience: "Complete beginners and developing beginners.",
  positioning:
    "A first course in 3D that starts with the idea, then shows you how Blender does it. You learn what each thing is, why it matters and when to use it, so the software stops feeling like a wall of buttons.",
  included: [
    `${data.modules.length} modules and ${data.modules.reduce((n, m) => n + m.lessons.length, 0)} lessons`,
    "A first complete project: a simple product scene",
    ...data.bonus,
  ],
  faq: [
    { q: "Do I need any experience?", a: "No. The course is written for complete beginners and people still finding their feet. Nothing assumes you've used 3D software before." },
    { q: "Do I need to buy Blender?", a: "No. Blender is free and open source. The course shows you how to install it in Module 2." },
    { q: "Is it live or self-paced?", a: "Self-paced. You pay once, keep lifetime access and move through the lessons at your own speed." },
    { q: "How is this different from a YouTube tutorial?", a: "Each lesson starts with the concept (what it is and why it matters) before showing the steps in Blender. The aim is that you can explain what you did, not only repeat it." },
    { q: "How do I enrol?", a: "Create an account, then use the enrol panel on the course page. When enrolment is open it shows the current price and lets you pay securely with Paystack; you get access as soon as your payment is confirmed. If the panel says enrolment isn't open yet, it opens soon." },
  ],
};

export type CourseContent = typeof course;
