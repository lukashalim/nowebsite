import type { SpintaxAudience } from "@/lib/spintax-audience";
import type { SpintaxChannel } from "@/lib/spintax-channel";

export interface DefaultSpintaxTemplate {
  name: string;
  template: string;
  audience: SpintaxAudience;
  channel: SpintaxChannel;
}

export const DEFAULT_SPINTAX_TEMPLATES: DefaultSpintaxTemplate[] = [
  {
    name: "Facebook — Mobile friction",
    channel: "facebook",
    audience: "facebook",
    template:
      "{Hey|Hi|Hello} [Name] - noticed your Google listing uses Facebook as the main website link. Google actually added a specific spot just for social links now. When mobile users tap 'Website' and land on Facebook instead of a fast page with your number, a lot of them just {bounce and call|leave and call} a competitor. {Shot|Put together|Made} a quick {45-second|short} video showing how this leaks customers on mobile and how to structure it instead. {Mind if I drop the link here?|Want me to send it over?|OK if I share it here?}",
  },
  {
    name: "Facebook — AI angle",
    channel: "facebook",
    audience: "facebook",
    template:
      "{Hey|Hi|Hello} [Name] - I was {looking you up|checking you out|searching for you} on Google and noticed you're using Facebook as your {website|main website link|web presence}. That's {great|perfect|fine} for people already on Facebook, but more and more people are asking AI to help them find {[category]|a [category]|local [category]} in their area - and AI can't read Facebook pages. {Shot|Put together|Made} a quick {45-second|short} video showing how this {costs you customers|leaks customers|affects your business} and how to {fix it|structure it instead|set it up properly}. {Mind if I drop the link here?|Want me to send it over?|OK if I share it here?}",
  },
  {
    name: "No Facebook — Mobile search",
    channel: "facebook",
    audience: "no_facebook",
    template:
      "{Hey|Hi|Hello} [Name] - {noticed|saw} your Google listing {doesn't have a website link|has no website yet}. When mobile searchers {tap through|check listings}, {many skip|a lot skip} businesses {without a fast page|with no site} to see services and hours. {Put together|Made} a quick {demo|preview} of what yours could look like. {Mind if I send it over?|Want me to share it here?|OK if I drop the link?}",
  },
  {
    name: "No Facebook — AI discovery",
    channel: "facebook",
    audience: "no_facebook",
    template:
      "{Hey|Hi|Hello} [Name] - {looking for|searching for} [category] on Google and {noticed|saw} you {don't have a website listed|have no website on your listing}. More people are using AI to find local businesses—and AI needs a real site to {recommend you|surface you}. {Put together|Made} a short demo showing what a simple site could do for you. {OK if I drop the link?|Want me to send it?}",
  },
  {
    name: "SMS — Short mystery",
    channel: "sms",
    audience: "any",
    template:
      "{Hey|Hi} [Name] - your Google listing has a small guideline violation. {Want me to show you what it is?|Want to know what it is?|Should I explain?}",
  },
  {
    name: "SMS — Mobile friction",
    channel: "sms",
    audience: "facebook",
    template:
      "{Hey|Hi} [Name] - noticed your Google listing links to Facebook as the website. When someone taps it on their phone they land on Facebook instead of being able to call you directly. {Made|Shot|Put together} a quick video showing how to fix it. {Want me to send it?|Should I send it over?|Want to see it?}",
  },
  {
    name: "SMS — AI angle",
    channel: "sms",
    audience: "facebook",
    template:
      "{Hey|Hi} [Name] - more and more people are asking AI to find {[category]|local [category]} and AI can't read Facebook pages. Your Google listing links to Facebook as the website. {Want me to show you how to fix it?|Should I send a quick video?}",
  },
  {
    name: "Call — Mystery hook",
    channel: "call",
    audience: "any",
    template:
      "{Hi|Hey} [Name], I was looking at your Google listing for [category] and noticed something small that might be costing you calls. Do you have thirty seconds?",
  },
  {
    name: "Call — Mobile friction",
    channel: "call",
    audience: "facebook",
    template:
      "{Hi|Hey} [Name], I noticed your Google listing links to Facebook as the website. When someone taps it on their phone they land on Facebook instead of being able to call you directly. {Mind if I explain what I mean?|Can I walk you through it real quick?}",
  },
  {
    name: "Call — No website",
    channel: "call",
    audience: "no_facebook",
    template:
      "{Hi|Hey} [Name], I was searching for [category] in your area and noticed your Google listing {doesn't have a website|has no website link}. {A lot of|Many} mobile searchers skip businesses without a fast page to see services and hours. {Do you have a minute?|Got thirty seconds?}",
  },
];

export const DEFAULT_FACEBOOK_SPINTAX_TEMPLATES = DEFAULT_SPINTAX_TEMPLATES.filter(
  (t) => t.channel === "facebook",
);

export const DEFAULT_SMS_SPINTAX_TEMPLATES = DEFAULT_SPINTAX_TEMPLATES.filter(
  (t) => t.channel === "sms",
);

export const DEFAULT_CALL_SPINTAX_TEMPLATES = DEFAULT_SPINTAX_TEMPLATES.filter(
  (t) => t.channel === "call",
);
