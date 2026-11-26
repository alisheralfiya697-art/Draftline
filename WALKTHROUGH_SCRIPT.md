# Walkthrough Video Script (3–5 Minutes)

Record a continuous 3–5 minute screen capture demonstrating the live deployment and test suite.

## 0:00 – 0:40 | Demo Sign-In & Document Library
- Open the live app URL and show the **Sign in to Draftline** screen.
- Explain briefly that simulated demo authentication issues a server-signed HMAC Bearer token kept in memory (replacing spoofable headers).
- Click **Sign in** for **Maya Lin**.
- Point out the clean distinction in the workspace table between **Owned by you** and **Shared by [Owner] · Can edit / View only**, plus the **Owned by Me** and **Shared with Me** tabs.

## 0:40 – 1:40 | Create, Format, Rename, Save & Reload Persistence
- Click **New Document**.
- Rename the title inline to `Q4 Launch Plan`.
- Demonstrate rich-text formatting in the Tiptap toolbar:
  - Apply **Heading 1** and **Heading 2**.
  - Format text with **Bold**, *Italic*, and <u>Underline</u>.
  - Create both a **Bulleted list** and a **Numbered list**.
- Show the save indicator settling on **Saved** (and trigger `Ctrl/Cmd + S` or **Save**).
- Refresh the browser page (`Cmd/Ctrl + R`), sign back in as **Maya Lin**, and show that the document, title, and formatting persisted in SQLite (and `?doc=...` reopens it directly).

## 1:40 – 2:30 | File Import Flow (.txt, .md, .docx)
- Return to **All Documents** and click **Import File**.
- Briefly attempt an unsupported file (e.g. `.png`) to demonstrate clean validation feedback.
- Upload a `.md` or `.docx` file, open it directly in the rich-text editor, edit a heading or list item, and save.

## 2:30 – 3:35 | Sharing & Role Enforcement
- Click **Share** on `Q4 Launch Plan` and grant **Carlos Vega** `Can view` access.
- Open the top-right account menu, switch demo session to **Carlos Vega**, and click **Shared with Me**.
- Open `Q4 Launch Plan` and point out the **View-only** lock banner and disabled formatting toolbar.
- Switch back to **Maya Lin**, upgrade **Carlos Vega** to `Can edit`, switch back to **Carlos Vega**, make an edit, and verify it saves.

## 3:35 – 4:15 | Architecture, AI Workflow & Automated Tests
- Open **Project Notes** in the top bar (highlighting `ARCHITECTURE.md` and `AI_WORKFLOW.md`).
- In the terminal, run `npm test`, `npm run lint`, and `npm run build` to confirm all checks pass.
