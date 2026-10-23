/**
 * The legal documents shown at /legal/<slug>. Plain English, accurate to how this site actually works (processors,
 * cookies, data). "{email}" is replaced with the contact email from the site settings when the page renders.
 * Update `updated` whenever a document changes in substance.
 */
export type LegalBlock = string | { list: string[] } | { table: { head: string[]; rows: string[][] } };
export type LegalSection = { id: string; heading: string; blocks: LegalBlock[] };
export type LegalDoc = { slug: string; title: string; summary: string; updated: string; sections: LegalSection[] };

const UPDATED = "23 October 2026";

const privacy: LegalDoc = {
  slug: "privacy",
  title: "Privacy Policy",
  summary: "What personal information this website and Fola Academy collect, why, who helps us process it, how long we keep it, and the choices you have.",
  updated: UPDATED,
  sections: [
    {
      id: "who-we-are",
      heading: "Who we are",
      blocks: [
        "This website is run by Samson Afolabi Odejinmi (“Fola”), based in Lagos, Nigeria. It covers two things: the portfolio and creative services of Samson Odejinmi, and Fola Academy, which offers courses, books and other learning resources. In this policy “we”, “us” and “our” mean Samson Afolabi Odejinmi operating this website and Fola Academy.",
        "We are the data controller for the personal information described here. If you have a question about this policy or your information, email {email}.",
      ],
    },
    {
      id: "what-we-collect",
      heading: "Information we collect",
      blocks: [
        "We only collect what we need to run the site, deliver what you've asked for, and keep the service secure:",
        {
          list: [
            "Contact messages: your name, email address and the message you send through the contact form.",
            "Your account: your name, email address and an optional profile photo. Your password is handled by our authentication provider; it is stored only in hashed form and we can never see it.",
            "Learning records: the courses you enrol in, lessons you complete, quiz answers and scores, and your overall progress.",
            "Certificates: when you complete a course that offers one, a certificate is created with your name, the course title, the completion date and a unique certificate ID.",
            "Orders and payments: what you bought, the amount, currency, payment reference and status. If you check out as a guest we also keep the name and email address you give us so we can deliver your purchase. Card and bank details are entered on Paystack's secure pages and never reach our servers.",
            "Email preferences: whether you have agreed to receive news and marketing emails. This is always opt-in, and every marketing email has an unsubscribe link.",
            "Questions to the AI study assistant: the messages you send to the Academy's AI assistant and its replies, so it can answer in context.",
            "Referral and campaign information: if you arrive through an affiliate link or a campaign link, we record which link it was (see our Cookie Policy). Affiliate visits are stored as an anonymous, salted code, not as your identity.",
            "Security records: sign-in attempts, password resets and similar events, stored with a masked email and a one-way hashed IP address so we can detect abuse without keeping your raw IP address.",
          ],
        },
        "We don't use advertising trackers or third-party analytics, and we don't sell your personal information.",
      ],
    },
    {
      id: "how-we-use",
      heading: "How and why we use it",
      blocks: [
        "We use your information only for the purposes below, and only where the Nigeria Data Protection Act 2023 (and, for visitors in the EU or UK, the GDPR) gives us a lawful basis:",
        {
          list: [
            "To provide what you asked for (contract): creating your account, giving you access to courses and books you've bought or enrolled in, tracking your progress, issuing certificates, and delivering downloads.",
            "To take payments and keep records (contract and legal obligation): processing orders through Paystack and keeping the financial records the law requires.",
            "To reply to you (legitimate interest): answering contact messages and project enquiries.",
            "To send emails you asked for (consent): newsletters and announcements. You can withdraw consent at any time with the unsubscribe link or by emailing us. Service emails, such as receipts, password resets and certificate notices, are sent because they're part of the service.",
            "To keep the site safe (legitimate interest): preventing fraud, abuse and unauthorised access, and enforcing our terms.",
            "To credit referrals and understand which campaigns work (legitimate interest): attributing a purchase to an affiliate or campaign link.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      heading: "Certificate verification is public",
      blocks: [
        "Each certificate has a unique ID and a verification link so that employers, clients and others can confirm it is genuine. Anyone with the certificate ID can see the name on the certificate, the course, the completion and issue dates, and whether the certificate is valid. Your email address and account details are never shown. If you'd prefer a different form of your name to appear, contact us before sharing your certificate.",
      ],
    },
    {
      id: "processors",
      heading: "Service providers we use",
      blocks: [
        "We use a small number of trusted providers to run the site. They process personal information only on our instructions and for the purposes below:",
        {
          table: {
            head: ["Provider", "What they do for us"],
            rows: [
              ["Supabase", "Database, user accounts and sign-in, file storage (for example profile photos and downloads)."],
              ["Vercel", "Hosting the website and serving pages."],
              ["Paystack", "Processing payments. Paystack collects your card or bank details directly."],
              ["Resend", "Sending emails, such as receipts, account emails, certificate notices and newsletters you've opted into."],
              ["Anthropic", "Powering the AI study assistant; your questions and the relevant course material are sent to generate a reply."],
              ["YouTube (Google)", "Playing some course and portfolio videos, using YouTube's privacy-enhanced (no-cookie) mode."],
              ["Microlink", "Used only by the site owner to capture screenshots of public websites shown in the portfolio. No visitor data is sent."],
            ],
          },
        },
      ],
    },
    {
      id: "transfers",
      heading: "International transfers",
      blocks: [
        "Some of these providers store or process data outside Nigeria, for example in the European Union or the United States. Where that happens we rely on providers that offer appropriate safeguards, such as standard contractual clauses, and we transfer only what the service needs.",
      ],
    },
    {
      id: "retention",
      heading: "How long we keep information",
      blocks: [
        {
          list: [
            "Account and learning records: for as long as your account is open. If you ask us to delete your account, we delete or anonymise your personal information, except what we must keep by law.",
            "Order and payment records: for as long as the law requires for tax and accounting purposes (generally up to six years).",
            "Contact messages: for as long as needed to deal with your enquiry and any project that follows, then deleted.",
            "Certificates: kept so they can continue to be verified, unless you ask us to remove them.",
            "Security records: kept for a limited period to protect the service, in hashed form.",
          ],
        },
      ],
    },
    {
      id: "security",
      heading: "How we protect it",
      blocks: [
        "Data is sent over encrypted connections (HTTPS). Access to personal information is limited by role, and database rules make sure students can only see their own records. Passwords are hashed by our authentication provider, and payment details are handled by Paystack. No system is perfectly secure, but we take reasonable steps to protect your information and will tell you and the authorities if a breach puts you at risk, as the law requires.",
      ],
    },
    {
      id: "children",
      heading: "Children",
      blocks: [
        "The site isn't intended for children under 13, and they shouldn't create an account. Students aged 13 to 17 may use Fola Academy only with the permission and supervision of a parent or guardian, who is responsible for any purchase. If you believe a child has given us personal information without permission, contact us and we will delete it.",
      ],
    },
    {
      id: "your-rights",
      heading: "Your rights",
      blocks: [
        "Under the Nigeria Data Protection Act 2023 (and, where it applies, the GDPR) you can:",
        {
          list: [
            "ask for a copy of the personal information we hold about you;",
            "ask us to correct information that is wrong or incomplete (you can update most of it yourself in your profile settings);",
            "ask us to delete your information;",
            "ask for your information in a portable format;",
            "object to, or ask us to restrict, how we use it;",
            "withdraw consent at any time, for example by unsubscribing from emails.",
          ],
        },
        "To use any of these rights, email {email}. We will reply within 30 days and may need to confirm your identity first. If you're unhappy with how we've handled your information, you can complain to the Nigeria Data Protection Commission (NDPC), or to your local data protection authority if you live outside Nigeria.",
      ],
    },
    {
      id: "changes",
      heading: "Changes to this policy",
      blocks: [
        "We may update this policy when the site or the law changes. The date at the top shows the latest version. If a change is significant, we will tell signed-in students by email or on the site before it takes effect.",
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      blocks: ["For any privacy question or request, email {email}."],
    },
  ],
};

const terms: LegalDoc = {
  slug: "terms",
  title: "Terms of Use",
  summary: "The rules for using this website and for enquiring about creative and technical services from Samson Odejinmi.",
  updated: UPDATED,
  sections: [
    {
      id: "acceptance",
      heading: "About these terms",
      blocks: [
        "This website is run by Samson Afolabi Odejinmi, based in Lagos, Nigeria. By using it you agree to these terms. If you don't agree, please don't use the site.",
        "Courses, books and other Fola Academy products are also covered by the Fola Academy Terms and the Refund Policy. How we handle personal information is explained in the Privacy Policy.",
      ],
    },
    {
      id: "using-the-site",
      heading: "Using the site",
      blocks: [
        "You may browse the site, view the portfolio and share links to it for personal and non-commercial purposes. We work to keep the site available and accurate, but we may change, suspend or remove parts of it at any time without notice.",
      ],
    },
    {
      id: "intellectual-property",
      heading: "Intellectual property",
      blocks: [
        "Unless stated otherwise, the artwork, renders, animations, designs, videos, text, code and other material on this site belong to Samson Afolabi Odejinmi and are protected by copyright and other laws. You may not copy, download, reproduce, resell, use in AI training, or publish this material without written permission, except where the law allows it.",
        "Work made for clients is shown with their permission and remains subject to the agreement with that client. Third-party names, logos and trademarks belong to their owners and appear only to describe the work.",
      ],
    },
    {
      id: "services",
      heading: "Project enquiries and services",
      blocks: [
        "Sending an enquiry through the contact form or WhatsApp doesn't create a contract. Any quote, timeline or proposal is an estimate until we both agree the scope, price, deliverables, payment terms and ownership of the work in writing. That written agreement then governs the project and takes priority over these terms.",
      ],
    },
    {
      id: "acceptable-use",
      heading: "Acceptable use",
      blocks: [
        "You agree not to:",
        {
          list: [
            "break the law, or infringe anyone's rights, through the site;",
            "try to gain unauthorised access to the site, other people's accounts or our systems, or interfere with how they work;",
            "send spam, malware or misleading information through any form;",
            "scrape or copy the site's content at scale, or use automated tools to overload it;",
            "pretend to be someone else, or misrepresent your connection with us.",
          ],
        },
        "We may block access or remove content if these rules are broken.",
      ],
    },
    {
      id: "links",
      heading: "Links to other websites",
      blocks: [
        "The portfolio links to live websites, social profiles and other services that we don't control. We aren't responsible for their content, availability or privacy practices; please read their own terms.",
      ],
    },
    {
      id: "disclaimer",
      heading: "Disclaimer",
      blocks: [
        "The site and its content are provided “as is” for general information. Descriptions of past projects show the work as it was made and aren't a promise of a particular result for your project.",
      ],
    },
    {
      id: "liability",
      heading: "Limitation of liability",
      blocks: [
        "Nothing in these terms limits liability that can't be limited by law, such as liability for fraud or for death or personal injury caused by negligence. Otherwise, we aren't responsible for indirect or consequential losses, or for loss of profit, data or business opportunity, arising from your use of the site. For paid services, our liability is set out in the written agreement for that project.",
      ],
    },
    {
      id: "law",
      heading: "Governing law",
      blocks: [
        "These terms are governed by the laws of the Federal Republic of Nigeria. Any dispute will be handled by the courts of Lagos State, Nigeria, though we will always try to resolve a concern informally first. If you are a consumer living elsewhere, you keep any protections the law of your country gives you.",
      ],
    },
    {
      id: "changes",
      heading: "Changes to these terms",
      blocks: ["We may update these terms from time to time. The date at the top shows the current version, and continuing to use the site means you accept it."],
    },
    {
      id: "contact",
      heading: "Contact",
      blocks: ["Questions about these terms? Email {email}."],
    },
  ],
};

const academyTerms: LegalDoc = {
  slug: "academy-terms",
  title: "Fola Academy Terms",
  summary: "The agreement between you and Fola Academy when you create an account, enrol in a course, buy a book or earn a certificate.",
  updated: UPDATED,
  sections: [
    {
      id: "about",
      heading: "About these terms",
      blocks: [
        "Fola Academy is run by Samson Afolabi Odejinmi, based in Lagos, Nigeria. These terms apply when you create an account, enrol in a course, buy a book, guide, template or other digital product, use the student portal or AI study assistant, or receive a certificate. They sit alongside the Website Terms of Use, the Privacy Policy and the Refund Policy.",
        "By creating an account or making a purchase you confirm that you accept these terms.",
      ],
    },
    {
      id: "accounts",
      heading: "Your account",
      blocks: [
        {
          list: [
            "You must be at least 13 to create an account. If you're between 13 and 17, a parent or guardian must agree to these terms and make any purchase for you.",
            "Give accurate details. The name in your profile is the name that appears on your certificates.",
            "Keep your password private. Your account is for you alone; sharing your login, or letting others learn through your account, isn't allowed.",
            "Tell us straight away if you think someone else has used your account.",
          ],
        },
      ],
    },
    {
      id: "courses",
      heading: "Courses and access",
      blocks: [
        "When you enrol in a course you get access to its published lessons, resources and quizzes through the student portal. Unless the course page says otherwise, access lasts for as long as Fola Academy offers the course, including updates we make to it.",
        "Some courses are marked “Coming soon”. You can read about them and see the planned price, but they can't be bought or joined until they are published. Prices shown for a coming-soon course may change before it opens.",
        "We keep improving courses, so lessons, resources and order may change over time. If we ever have to stop offering a course you've paid for, we'll give you reasonable notice and either a way to keep studying the material you have or a fair refund.",
      ],
    },
    {
      id: "books",
      heading: "Books and digital products",
      blocks: [
        "Books, guides, templates and other digital products are delivered as downloads or online access after payment. Download links may be limited in number or time to protect the files; if a link stops working, sign in to your library or contact us and we will help.",
      ],
    },
    {
      id: "prices",
      heading: "Prices and payment",
      blocks: [
        "Prices are shown on each course or product page in the currencies we sell in. The price you pay is the one shown at checkout, including any valid coupon. Payments are processed securely by Paystack; we never see or store your card details. Your bank or card provider may charge its own fees, for example for currency conversion.",
        "A purchase is complete once Paystack confirms the payment. If a payment fails or is reversed, access may be paused until it is settled.",
      ],
    },
    {
      id: "licence",
      heading: "What you may do with the material",
      blocks: [
        "Course videos, lessons, books, project files and other materials belong to Samson Afolabi Odejinmi. Your purchase gives you a personal, non-transferable, non-exclusive licence to use them for your own learning. You may use what you learn, and the work you create, in your own projects, including paid ones.",
        "You may not:",
        {
          list: [
            "share, upload, sell, lend or publish course videos, ebooks, files or downloads, in whole or in part;",
            "record, screen-capture or redistribute lessons;",
            "share your account or login details;",
            "remove copyright notices or watermarks;",
            "use the materials to create a competing course or product, or to train AI models.",
          ],
        },
        "Some products may include their own licence, for example a template you can use in client work. Where they do, that licence applies.",
      ],
    },
    {
      id: "conduct",
      heading: "Student conduct",
      blocks: [
        "Be respectful in any messages, reviews or community spaces. Don't post anything unlawful, abusive or misleading, or anyone else's private information. Reviews must reflect your own honest experience of a product you own. We may remove content or suspend accounts that break these rules.",
      ],
    },
    {
      id: "ai-assistant",
      heading: "The AI study assistant",
      blocks: [
        "Some courses include an AI study assistant that answers questions about the material. It is a learning aid, not a replacement for the course or the instructor, and it can make mistakes, so check important information against the lessons. Don't share passwords, payment details or other sensitive personal information with it. Your messages are processed as described in the Privacy Policy.",
      ],
    },
    {
      id: "certificates",
      heading: "Certificates",
      blocks: [
        "Where a course offers a certificate, it is issued automatically when you complete every required lesson and, if the course requires it, pass its quizzes. We may also issue a certificate manually, for example for work completed offline.",
        {
          list: [
            "A Fola Academy certificate is a certificate of completion. It confirms that you completed the course; it is not an accredited academic qualification, degree or professional licence.",
            "Each certificate has a unique ID and can be checked by anyone on the verification page at /verify. The page shows the name on the certificate, the course, the dates and whether it is valid.",
            "We may revoke a certificate that was obtained dishonestly, for example through account sharing or cheating on quizzes, or issued by mistake. A revoked certificate shows as not valid.",
          ],
        },
      ],
    },
    {
      id: "refunds",
      heading: "Refunds",
      blocks: ["Refunds are covered by our Refund Policy. Nothing in these terms affects your rights under consumer protection law."],
    },
    {
      id: "termination",
      heading: "Suspension and closing your account",
      blocks: [
        "You can close your account at any time by contacting us. We may suspend or close an account that breaks these terms, for example by sharing logins or redistributing material, after giving you a chance to explain unless the breach is serious. If we close your account without good reason, we will refund the unused part of anything you paid for.",
      ],
    },
    {
      id: "liability",
      heading: "Limitation of liability",
      blocks: [
        "We teach carefully, but we can't guarantee any particular result, such as a job, client or income, from taking a course. Nothing in these terms limits liability that can't be limited by law. Otherwise, our total liability to you for any claim relating to a purchase is limited to the amount you paid for it, and we aren't responsible for indirect or consequential losses.",
      ],
    },
    {
      id: "law",
      heading: "Governing law",
      blocks: [
        "These terms are governed by the laws of the Federal Republic of Nigeria, and the courts of Lagos State have jurisdiction. If you live elsewhere you keep the consumer protections of your own country. Please contact us first; most concerns can be sorted out quickly.",
      ],
    },
    {
      id: "changes",
      heading: "Changes to these terms",
      blocks: ["We may update these terms. Changes don't reduce access to anything you've already bought. If a change is significant we will tell you by email or on the site before it applies."],
    },
    {
      id: "contact",
      heading: "Contact",
      blocks: ["Questions about the Academy, your account or a purchase? Email {email}."],
    },
  ],
};

const refunds: LegalDoc = {
  slug: "refund-policy",
  title: "Refund Policy",
  summary: "When you can get your money back for a course, book or other purchase from Fola Academy, and how to ask.",
  updated: UPDATED,
  sections: [
    {
      id: "courses",
      heading: "Courses",
      blocks: [
        "If a course isn't right for you, you can ask for a full refund within 7 days of buying it, as long as:",
        {
          list: [
            "you have completed no more than a quarter (25%) of its lessons, and",
            "no certificate has been issued for it.",
          ],
        },
        "After 7 days, or once you've gone further through the course, refunds are at our discretion, for example if a technical problem on our side stopped you from using it.",
      ],
    },
    {
      id: "digital-products",
      heading: "Books and digital downloads",
      blocks: [
        "Because books, guides, templates and other downloads can't be returned once you have them, they are non-refundable once downloaded or opened. We will always refund or replace a product that:",
        {
          list: [
            "is faulty or can't be opened, and we can't fix it;",
            "is materially different from its description; or",
            "you bought twice by mistake.",
          ],
        },
        "If you haven't downloaded or opened a product yet, you can ask for a refund within 7 days of buying it.",
      ],
    },
    {
      id: "payment-problems",
      heading: "Failed or duplicate payments",
      blocks: [
        "If you were charged but your order didn't go through, or you were charged twice for the same order, contact us with the details and we will refund the extra charge in full once Paystack confirms it.",
      ],
    },
    {
      id: "how-to-ask",
      heading: "How to ask for a refund",
      blocks: [
        "Email {email} from the address you used to buy, with your order or payment reference (it's on your receipt) and a short note about the reason. We aim to reply within 3 working days.",
      ],
    },
    {
      id: "how-refunds-are-paid",
      heading: "How refunds are paid",
      blocks: [
        "Approved refunds are made in full, for the amount you paid, to your original payment method through Paystack. We can't refund to a different card or account. Once we have processed a refund, it usually reaches you within 5 to 10 working days, depending on your bank or card provider.",
        "When a refund is made, access to the course or product ends, and any certificate issued for that course may be revoked.",
      ],
    },
    {
      id: "services",
      heading: "Creative and technical services",
      blocks: ["Payments for client projects, such as design, animation or website work, are covered by the written agreement for that project, including any deposit and cancellation terms."],
    },
    {
      id: "your-rights",
      heading: "Your legal rights",
      blocks: ["This policy is in addition to your rights under consumer protection law, including the Federal Competition and Consumer Protection Act 2018, and doesn't reduce them."],
    },
  ],
};

const cookies: LegalDoc = {
  slug: "cookies",
  title: "Cookie Policy",
  summary: "The small number of cookies this site uses, what each one does and how long it lasts. There are no advertising or analytics cookies.",
  updated: UPDATED,
  sections: [
    {
      id: "what-are-cookies",
      heading: "What cookies are",
      blocks: [
        "Cookies are small text files a website stores in your browser so it can remember things between pages or visits. Similar technology, such as your browser's local storage, works in the same way.",
      ],
    },
    {
      id: "cookies-we-use",
      heading: "The cookies we use",
      blocks: [
        "We use only the cookies below. None of them is used for advertising, and we don't use third-party analytics.",
        {
          table: {
            head: ["Name", "What it does", "How long", "Type"],
            rows: [
              ["sb-… (several)", "Keeps you signed in to your account securely.", "Your session, refreshed while you use the site", "Strictly necessary"],
              ["fa_cart", "Remembers what's in your cart.", "30 days", "Strictly necessary"],
              ["fa_o_<reference>", "Lets you open a guest order and its downloads on this device.", "30 days", "Strictly necessary"],
              ["fa_currency", "Remembers the currency you chose for prices.", "180 days", "Functional"],
              ["fola_ref", "Records the affiliate link you arrived through, so the right person is credited for a referral.", "30 days", "Referral"],
              ["fola_attr", "Records which campaign brought you here (for example the source and campaign name in a link) and your landing page.", "90 days", "Referral"],
              ["theme (local storage)", "Remembers whether you prefer the light or dark look.", "Until you clear it", "Functional"],
            ],
          },
        },
        "Videos are played through YouTube's privacy-enhanced mode, which doesn't set YouTube cookies until you play a video.",
      ],
    },
    {
      id: "control",
      heading: "Controlling cookies",
      blocks: [
        "You can block or delete cookies in your browser settings. If you block strictly necessary cookies, you won't be able to sign in or check out. Blocking functional or referral cookies won't stop the site working; it just won't remember your choices or credit a referral.",
      ],
    },
    {
      id: "changes",
      heading: "Changes",
      blocks: ["If we add or change a cookie, we will update this page. The date at the top shows the latest version. Questions? Email {email}."],
    },
  ],
};

export const LEGAL_DOCS: LegalDoc[] = [privacy, terms, academyTerms, refunds, cookies];
export const legalDoc = (slug: string) => LEGAL_DOCS.find((d) => d.slug === slug) ?? null;
