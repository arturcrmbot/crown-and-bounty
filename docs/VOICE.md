# The game's voice

Artur set the voice on 30 Sep 2026 (#145, #149). The game's words read the way Heroes of Might and Magic II's own
messages do. They are plain, full sentences that speak to the player. They say what you see and what you get, each
character talks in their own voice, and a joke is dry and lands once. HoMM2's English text is kept by fheroes2 as the
`msgid` lines of its translation files (for example `files/lang/nl.po`), and it is worth reading a few hundred of them
before writing a card. Take their rhythm and plainness rather than their words.

## The rules

1. **Speak to the player.** The narrator says "you", in the present tense. "You come upon a crooked cottage." "You find
   **500 gold**."
2. **Say what you see, then what happens, then what you get.** The reward comes last, plainly, in bold: "Among the
   spoils you find **Grimsby’s Carving Knife**."
3. **Write full sentences.** Every sentence has someone doing something. No captions ("An old tower, long empty."), no
   tags ("+20 leadership."), and no clipped phrases ("Moth-eaten, much loved.").
4. **No colons, dashes or semicolons in the narration.** Join the thought with "and", "so", "but", "because" or
   "which", or start a new sentence. Speech is brought in with a comma: The Baron shouts, "Get him!"
5. **No asides in brackets.** If it matters, say it in the sentence. If it doesn't, cut it.
6. **Plain words.** No put-on old-fashioned wording in the narration: no "whilst", "ere", "'tis", "hither" or
   "verily". The King can say "Splendid", and Old Nan can say "dearie", because that's how they talk.
7. **A joke is dry and lands once,** usually at the end of the line. Don't explain it, and don't add a second one.
8. **Only the words change.** Numbers, names, story flags and rules stay as they are. Numbers are figures, with commas
   from a thousand up (1,500 gold).
9. **Read it aloud.** If you'd stumble over it, rewrite it.

Some words keep their own shape. **Speech** stays the way each character talks. **A sign, a poster or a letter**
reads like one: the WANTED poster, the signpost, Grimsby's toll board and his orders. **Labels** in the bars, on the
hero screen and in hover labels can keep their colons, as HoMM2's did ("Attack: 2"). **Buttons** are short commands in
the player's voice ("Take the banner", "Retreat"). The pitch for the link and the words on the turn-your-phone screen
are Artur's own (#147), so leave them exactly as he chose them.

Issues, pull requests and messages to Artur are written the same plain way.

## Before and after

These come from Commission I, as it read before and after #149.

| Before | After |
| --- | --- |
| A forgotten ore cart, still full: a good **400 gold** of it. | You find a forgotten ore cart, still full of ore worth a good **400 gold**. |
| In a pocket of the coat: a purse of the old King’s crowns. | In a pocket of the coat you find a purse of the old King’s crowns. |
| Word on the road: the Baron has told **Rook the Huntsman** to bring you in, and let his wolves off the leash. | Word reaches you that the Baron has told **Rook the Huntsman** to bring you in, and Rook has let his wolves off the leash. |
| You pry the lid off. Inside: **500 gold**. | You pry the lid off and find **500 gold** inside. |
| **+1605 experience.** | You gain **1,605 experience**. |
| Population 340. Friendly, if nosy. | The 340 people of Westmere are friendly, if nosy. |
| Truffles where they were rooting! Worth {gold} at market. | Where they were rooting you find truffles, worth {gold} at market. |
| He holds up a **loaf** that has not gone stale in living memory (*nobody marches on an empty stomach*)... | He holds up a **loaf** that has not gone stale in living memory, because nobody marches on an empty stomach... |
| ...nobody can strike back, but it winds them: they can’t strike back themselves for the rest of that round and the next. | ...nobody can strike back. The charge winds them, though, so they can’t strike back themselves for the rest of that round and the next. |
| *Five villains, one lost sceptre, and a stolen goose.* | *The King has lost five provinces, his sceptre and his goose, and he wants them all back.* |
