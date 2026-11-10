# Folio — AI Assignment Planner
CS 4680 · Prompt Engineering · Assignment 4

Students can turn a sentence into a saved assignment, filter deadlines, download a CSV, and review a deletion. The app runs entirely in a browser and uses IndexedDB for assignments and audit history. Each visitor has their own workspace in each browser profile.

## Run
From the repository root, run `python -m http.server 8000 --directory dist` and open http://localhost:8000. Run `node test.mjs` with Node 20+ for executor regression checks.

## Try it
Guided examples work immediately. Click **Add assignment** then **Run request**. Try listing or exporting, then download the CSV. Request deletion and choose **Keep assignment** or **Confirm deletion**. Expand **Inspect command** to see the parsed JSON. Guided examples use preset commands and do not call a model.

For open-ended requests choose **Live AI · Puter**. Sign in to Puter and allow pop-ups at the site. Puter uses the visitor's account quota. Live mode sends the request and the current browser's assignment catalog to GPT-4o-mini using puter.ai.chat. No developer API key is bundled. If a request fails, the error appears in the audit log. Retry rate-limited requests after a minute.

Try “Add my sorting worksheet for CS 3310 due next Friday,” “Which CS 3310 assignments are due this month?” and “Export my CS 3310 deadlines to CSV.”

## Design
- dist/agent.mjs builds the system and user messages, validates typed commands, executes allowlisted actions, and encodes CSV. The prompt uses role separation, JSON examples, an explicit date convention and clarification for incomplete or ambiguous requests.
- dist/app.mjs connects the model, parses JSON, stores assignments and audit entries together in one IndexedDB transaction, renders feedback, and handles confirmation. No model-provided field can authorize deletion.
- dist/index.html and style.css provide the responsive UI. The activity panel shows the newest 60 records while the database retains earlier entries.
- For GitHub Pages, the included workflow publishes the dist directory. In Settings → Pages select GitHub Actions, then run the workflow from Actions or push to main. The demo is also available at demo.mp4 under the site URL.

## Limits
Browser data stays on the current origin and profile. Clearing site data clears the planner. Live access needs an online Puter account with available quota. CSV export creates a download link, and the visitor saves the file. The walkthrough uses guided examples so it can be reproduced without an account.
