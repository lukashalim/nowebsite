export interface DefaultSpintaxTemplate {
  name: string;
  template: string;
}

export const DEFAULT_SPINTAX_TEMPLATES: DefaultSpintaxTemplate[] = [
  {
    name: "Version 1 — Mobile friction",
    template:
      "{Hey|Hi|Hello} [Name] - noticed your Google listing uses Facebook as the main website link. Google actually added a specific spot just for social links now. When mobile users tap 'Website' and land on Facebook instead of a fast page with your number, a lot of them just {bounce and call|leave and call} a competitor. {Shot|Put together|Made} a quick {45-second|short} video showing how this leaks customers on mobile and how to structure it instead. {Mind if I drop the link here?|Want me to send it over?|OK if I share it here?}",
  },
  {
    name: "Version 2 — AI angle",
    template:
      "{Hey|Hi|Hello} [Name] - I was {looking you up|checking you out|searching for you} on Google and noticed you're using Facebook as your {website|main website link|web presence}. That's {great|perfect|fine} for people already on Facebook, but more and more people are asking AI to help them find {[category]|a [category]|local [category]} in their area - and AI can't read Facebook pages. {Shot|Put together|Made} a quick {45-second|short} video showing how this {costs you customers|leaks customers|affects your business} and how to {fix it|structure it instead|set it up properly}. {Mind if I drop the link here?|Want me to send it over?|OK if I share it here?}",
  },
];
