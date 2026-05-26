# Hero Demo Scenario

The locked demo prompt for the 60-second submission video. Plans A, B, and C
all build for this exact path. Do not change without team alignment.

## The prompt

> "Setting up a reading nook in a small Boston apartment, budget around $800.
> I want it cozy but not cluttered — warm tones, no minimalist white box.
> What should I get?"

## Expected agent behavior

1. Either asks one focused clarifying question (e.g. "Do you have a chair
   already, or are we starting from scratch?") OR goes straight to a search.
2. Calls `searchProducts` at least once with style/budget filters.
3. Returns 2-3 product cards in the UI grid.
4. Each pick has a one-sentence reason grounded in the scenario ("small
   apartment", "warm tones", "cozy") — not generic praise.
5. Cites a tradeoff from a real review if the user follows up.

## Demo path (60-second video)

1. (10s) "Wayfair has 22M customers a year. Most still shop with filters
   and search bars. We built a concierge that shops with you."
2. (35s) Type the hero prompt verbatim. Show the conversation, the cards,
   click into reviews if time allows.
3. (15s) "Three tools, one agent, grounded in real Wayfair products pulled
   via Apify. Subconscious-powered."
