/**
 * Legal documents for TryAnything.
 *
 * Written to match what the code actually does (see docs/ARCHITECTURE.md and docs/SECURITY.md).
 * If you change data handling (e.g. add accounts, recordings, a database), update these texts.
 * Replace every [BRACKETED] placeholder before launch and have the texts reviewed by a lawyer.
 */
export type LegalBlock = string | { list: string[] };
export type LegalSection = { heading: string; blocks: LegalBlock[] };
export type LegalDoc = { slug: "privacy" | "terms" | "aup"; title: string; summary: string; sections: LegalSection[] };

export const LEGAL_UPDATED = "29 October 2026";
export const CONTACT_EMAIL = "[privacy@yourdomain.com]";
const GRIEVANCE = "[Grievance Officer name], reachable at " + CONTACT_EMAIL;

const privacy: LegalDoc = {
  slug: "privacy",
  title: "Privacy Policy",
  summary:
    "Your photo or camera video is sent to our AI provider only when you ask for a preview. TryAnything does not store your photos, video or previews, has no accounts, uses no cookies or analytics, and never asks for your name or email.",
  sections: [
    {
      heading: "1. Who we are",
      blocks: [
        `TryAnything ("we", "us") is a web app that shows an AI preview of clothes and accessories on a photo of you, or live through your device camera. For the purposes of India's Digital Personal Data Protection Act, 2023 ("DPDP Act") we are the Data Fiduciary, and for the EU/UK GDPR we are the controller, of the personal data described below. Contact: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: "2. What we process and why",
      blocks: [
        {
          list: [
            "Photos (photo mode). When you press \"Try it on\", your browser first shrinks the photo and removes its metadata (such as GPS location), then sends it, together with the item image, to our server. Our server passes them to our AI provider, Decart, and returns the preview to your browser. The images exist only in memory for the duration of that request; we do not save them to disk, a database or logs. Purpose: providing the preview. Basis: your consent.",
            "Live camera video (live mode). Only after you tick the consent box, press Start and allow camera access, your video is streamed directly from your browser to Decart, which returns a video of you wearing the selected item. It does not pass through our servers and we do not record it. Basis: your consent.",
            "Technical data. IP address, browser type and request times, processed by our hosting provider in request logs, and by us in memory for about a minute to limit how often previews can be requested. Our own server logs record only outcomes and timings (for example \"preview created in 12 s\"), never images or IP addresses. Basis: legitimate interests / legitimate use.",
          ],
        },
        "We do not collect your name, email, phone number, location or payment details. There are no accounts, profiles, analytics or advertising trackers, and we do not use your data to train AI models. Photos you pick stay in your browser's memory only until you leave or reload the page.",
      ],
    },
    {
      heading: "3. Who we share it with",
      blocks: [
        {
          list: [
            "Decart (AI provider): receives your photo or live camera stream and the item image to generate the preview. How long Decart keeps this data is governed by its own terms and privacy policy at docs.platform.decart.ai; please read them before use.",
            "Our hosting provider: serves the website and keeps standard request logs (not images).",
            "Authorities, where the law requires it.",
          ],
        },
        "We do not sell or rent personal data.",
      ],
    },
    {
      heading: "4. How long we keep it",
      blocks: [
        {
          list: [
            "Photos, camera video and previews: not stored by us. Live sessions are limited to a few minutes, and end sooner if you leave the page or switch tabs.",
            "Server and hosting logs (no images): up to [30] days, then deleted.",
            "Rate-limit counters: held in memory for about one minute.",
          ],
        },
      ],
    },
    {
      heading: "5. Cookies and storage",
      blocks: [
        "TryAnything does not set cookies and does not use your browser's local storage. Images are served from our own domain and no third-party scripts or fonts are loaded.",
      ],
    },
    {
      heading: "6. International transfers",
      blocks: [
        "Our providers may process data outside India and outside your country, including in the United States. Where GDPR applies, transfers rely on appropriate safeguards such as the European Commission's Standard Contractual Clauses. Transfers from India follow the DPDP Act and any restrictions notified under it.",
      ],
    },
    {
      heading: "7. Your rights",
      blocks: [
        "Depending on where you live, you can:",
        {
          list: [
            "withdraw consent at any time: cancel a preview, stop a session, close the tab, or block camera access in your browser settings;",
            "ask for access to, correction of, or erasure of personal data we hold about you;",
            "object to or restrict processing, and ask for data portability (GDPR);",
            "nominate another person to exercise your rights in case of death or incapacity (DPDP Act);",
            "complain to a regulator: the Data Protection Board of India, or your local data protection authority in the EU/UK.",
          ],
        },
        `Because we don't store images or know who you are, we usually hold no personal data that we could return or delete. Email ${CONTACT_EMAIL}; we reply within 30 days.`,
      ],
    },
    {
      heading: "8. Grievance Officer",
      blocks: [`Questions or complaints about your data can be sent to our Grievance Officer: ${GRIEVANCE}. We aim to resolve grievances within 30 days.`],
    },
    {
      heading: "9. Age limit",
      blocks: [
        "TryAnything is only for people aged 18 or over. We do not knowingly process data of children. If you believe a child has used the service, contact us and we will delete any related data.",
      ],
    },
    {
      heading: "10. Security",
      blocks: [
        "Photos and video travel over encrypted connections (HTTPS / WebRTC). Our permanent AI-provider key stays on our servers; for live mode your browser receives only a short-lived token that expires within a minute and caps the session length. No system is perfectly secure, but we limit what we collect so there is little to expose.",
      ],
    },
    {
      heading: "11. Changes",
      blocks: ["If we change how we handle data, we will update this page and the date at the top. For significant changes we will also let you know in the app."],
    },
  ],
};

const terms: LegalDoc = {
  slug: "terms",
  title: "Terms of Service",
  summary: "Use TryAnything for fun and shopping inspiration. The AI preview is an approximation, not a promise of fit or appearance.",
  sections: [
    {
      heading: "1. Agreement",
      blocks: [
        "By requesting a preview in TryAnything you agree to these Terms, our Privacy Policy and our Acceptable Use Policy. If you do not agree, do not use the service.",
      ],
    },
    { heading: "2. Eligibility", blocks: ["You must be at least 18 years old and able to enter into a binding contract."] },
    {
      heading: "3. The service",
      blocks: [
        "TryAnything shows an AI-generated preview of you wearing sample or uploaded clothes and accessories, either on a photo or live through your camera. The service is free, offered \"as is\", and may change, be limited (for example, session length or how often you can start one) or stop at any time.",
      ],
    },
    {
      heading: "4. AI output",
      blocks: [
        {
          list: [
            "Previews are generated by an AI model and may be inaccurate, including in colour, size, fit, body shape or appearance. Do not rely on them for purchase, sizing, medical or other decisions.",
            "Previews are not saved by us. If you capture them yourself (for example with a screenshot), you are responsible for how you use and share them.",
          ],
        },
      ],
    },
    {
      heading: "5. Your conduct",
      blocks: ["You must follow the Acceptable Use Policy. We may end sessions or block access if you break it or if we reasonably suspect abuse."],
    },
    {
      heading: "6. Third-party services",
      blocks: [
        "The AI preview is provided by Decart, and your use of it is also subject to Decart's terms and acceptable use policy at docs.platform.decart.ai.",
      ],
    },
    {
      heading: "7. Intellectual property",
      blocks: [
        "The TryAnything name, design and software belong to us or our licensors. Sample item images are used under licence or are our own. Only upload item images you have the right to use. You may not copy, resell or reverse-engineer the service, or access our APIs except through the app.",
      ],
    },
    {
      heading: "8. Disclaimers and liability",
      blocks: [
        "To the extent permitted by law, the service is provided without warranties of any kind, and we are not liable for indirect, incidental or consequential losses, or for any loss arising from purchases you make based on a preview. Nothing in these Terms limits liability that cannot be limited by law, or your statutory rights as a consumer, including under India's Consumer Protection Act, 2019 or the laws of your country.",
      ],
    },
    {
      heading: "9. Governing law",
      blocks: [
        "These Terms are governed by the laws of India. Courts at [City], India have jurisdiction, without affecting any mandatory right you have to bring a claim where you live.",
      ],
    },
    {
      heading: "10. Changes and contact",
      blocks: [`We may update these Terms; the date at the top shows the latest version. Questions: ${CONTACT_EMAIL}.`],
    },
  ],
};

const aup: LegalDoc = {
  slug: "aup",
  title: "Acceptable Use Policy",
  summary: "Try clothes on yourself, respectfully. No nudity, no one else without consent, no minors, no abuse of the system.",
  sections: [
    {
      heading: "1. Only you, with consent",
      blocks: [
        "Use photos of yourself and the camera on yourself. Anyone else in a photo or in the frame must be 18 or over and must have agreed to be included. Never point the camera at someone without their knowledge.",
      ],
    },
    {
      heading: "2. Prohibited content",
      blocks: [
        "You must not use TryAnything to create, attempt to create, capture or share:",
        {
          list: [
            "nudity, sexual or sexually suggestive content, or attempts to remove or reduce clothing;",
            "any content involving a person under 18;",
            "content that impersonates, harasses, bullies, demeans or defames anyone, or misleading \"deepfake\" content of a real person;",
            "hateful, violent or illegal content, or content that infringes someone else's rights.",
          ],
        },
      ],
    },
    {
      heading: "3. Prohibited use of the system",
      blocks: [
        {
          list: [
            "Automating, scripting or scraping the service, or calling our APIs outside the app;",
            "getting around session limits, rate limits, safety filters or any other protection;",
            "reselling the service or access to it, or using it to build a competing product;",
            "interfering with or overloading the service, or probing it for vulnerabilities without our written permission.",
          ],
        },
      ],
    },
    {
      heading: "4. Our AI provider's rules",
      blocks: ["Previews are generated by Decart, so its acceptable use policy (docs.platform.decart.ai) also applies to your use."],
    },
    {
      heading: "5. Enforcement and reporting",
      blocks: [
        `We may end a session, block access, and where required report illegal content to the authorities. To report misuse, email ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDoc["slug"], LegalDoc> = { privacy, terms, aup };
