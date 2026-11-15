import { broadcastResponseToMainFrame } from "@azure/msal-browser/redirect-bridge";
broadcastResponseToMainFrame().catch(() => {
  document.body.textContent =
    "Microsoft sign-in did not complete. Close this window and reconnect from Zoro.";
});
