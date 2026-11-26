# Submission Deliverables — Draftline

## 1. Submission Links
- **Live Deployment URL**: `https://ais-pre-7fwstimnwg65sp5fetln7h-284446791353.asia-southeast1.run.app` *(Preview dev URL: `https://ais-dev-7fwstimnwg65sp5fetln7h-284446791353.asia-southeast1.run.app`)*
- **Final Custom Production URL (if redeployed externally)**: `<ADD_FINAL_DEPLOYMENT_URL_HERE>`
- **Google Drive Folder URL**: `<ADD_GOOGLE_DRIVE_FOLDER_URL_HERE>`
- **Walkthrough Video URL (3–5 minutes)**: `<ADD_WALKTHROUGH_VIDEO_URL_HERE>`

## 2. Demo User Accounts (Simulated Demo Auth)
Open the app and select any seeded user on the **Sign in to Draftline** screen (no passwords required):

| Name | Email | Role | Seeded Documents / Access |
| :--- | :--- | :--- | :--- |
| **Maya Lin** | `maya@draftline.app` | Product Lead | Owns 2 docs; Editor on Devon's RFC; Viewer on Priya's Runbook |
| **Devon Brooks** | `devon@draftline.app` | Staff Engineer | Owns 1 doc; Editor on Maya's Q4 Scope |
| **Priya Nair** | `priya@draftline.app` | Design Systems | Owns 1 doc; Viewer on Maya's Q4 Scope |
| **Carlos Vega** | `carlos@draftline.app` | Operations | Editor on Priya's Runbook (ideal target for testing fresh sharing) |

## 3. Included Repository Files
- Complete application source (`server.ts`, `server/*`, `src/*`, `tests/api.test.ts`)
- `README.md` — Overview, setup, environment variables, testing, and deployment
- `ARCHITECTURE.md` — Frontend/backend architecture, SQLite schema, API design, auth, and security
- `AI_WORKFLOW.md` — AI usage, rejected/modified outputs, and actual verified test/build results
- `WALKTHROUGH_SCRIPT.md` — 3–5 minute recording script

## 4. Deployment Instructions (Persistent Storage)
1. Ensure **Node.js `>= 22.14.0`**.
2. Install and build:
   ```bash
   npm install
   npm run build
   ```
3. Mount a persistent writable disk/volume and configure environment variables:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `DATA_DIR=/path/to/persistent/volume` *(stores `draftline.db` across restarts/redeploys)*
   - `SESSION_SECRET=<32+-char-random-secret>` *(recommended in production)*
4. Start the server:
   ```bash
   npm start
   ```

## 5. Manual Checklist Before Final Submission
- [ ] Capture screenshots of the working app (Demo Sign-In, Document Library, Tiptap Editor, Import Modal, Share Modal, View-Only Banner).
- [ ] Record the 3–5 minute walkthrough video following `WALKTHROUGH_SCRIPT.md`.
- [ ] Upload the walkthrough video, screenshots, and documentation (`README.md`, `ARCHITECTURE.md`, `AI_WORKFLOW.md`) to your Google Drive folder with *Anyone with the link can view* enabled.
- [ ] Fill in `<ADD_GOOGLE_DRIVE_FOLDER_URL_HERE>` and `<ADD_WALKTHROUGH_VIDEO_URL_HERE>` above.
