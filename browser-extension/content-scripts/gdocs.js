// Runs inside docs.google.com/document/*. Google Docs renders its content on
// a <canvas> (not real DOM text), which is the hard part of this piece --
// there is no simple contenteditable to read/write like Gmail's compose box.
//
// Realistic options to research before building this out:
//   1. Google Docs API (via OAuth) -- read/write the doc's real content
//      server-side, poll or use push notifications for changes. Most robust,
//      but requires the user to grant Docs access, and isn't truly "live" like
//      an underline-as-you-type UI.
//   2. Reverse-engineer the hidden accessibility text layer Docs renders for
//      screen readers -- fragile, breaks on Docs updates.
// Grammarly's Docs support historically leaned on approach 2 for live editing
// and/or backend API integration for some features -- worth checking their
// current approach before committing here.
//
// Stub below is intentionally minimal until that decision is made.

console.log("Exelidoc: Google Docs content script loaded (not yet implemented).");
