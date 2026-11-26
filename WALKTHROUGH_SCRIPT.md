# Walkthrough Video Script (3–5 Minutes)

Use this shot list to record a crisp 3.5-minute walkthrough covering every requirement.

## 0:00 – 0:35 | Overview & Document Library
- Open the deployed app URL in the browser.
- Point out the clean workspace header: `Draftline` wordmark, view links (`All Documents`, `Owned by Me`, `Shared with Me`, `Project Notes`), and the active seeded user switcher (`Maya Lin`).
- Highlight the clear distinction in the table between **Owned by you** and **Shared by [Owner] · Can edit / View only**.

## 0:35 – 1:30 | Create, Format, Rename, Save & Refresh Persistence
- Click **New Document**.
- Rename the title inline from `Untitled Document` to `Product Launch Brief`.
- Demonstrate rich-text formatting in the Tiptap toolbar:
  - Type a title and apply **Heading 1** and **Heading 2**.
  - Write a paragraph using **Bold**, *Italic*, and <u>Underline</u>.
  - Add a **Bulleted list** and a **Numbered list**.
- Point to the save indicator transitioning from `Unsaved changes` -> `Saving...` -> `Saved` (and show manual **Save** / `Ctrl+S`).
- Refresh the browser page (`Cmd/Ctrl + R`) to verify the document, title, formatting, and active user persist across reloads.

## 1:30 – 2:20 | File Import Flow (.txt, .md, .docx)
- Return to **All Documents** and click **Import File**.
- Upload a sample `.md` or `.docx` file (also briefly show the validation error when attempting an unsupported file like `.png`).
- Show the imported document opening directly in the rich-text editor with preserved headings, emphasis, and lists, ready for further editing.

## 2:20 – 3:25 | Sharing & Permission Enforcement
- Click **Share** on `Product Launch Brief`.
- Grant **Carlos Vega** `Can view` access and explain the collaborator list.
- Switch the top-right user selector to **Carlos Vega**.
- Click **Shared with Me**, open `Product Launch Brief`, and show the view-only banner (toolbar disabled, cannot edit or delete).
- Switch back to **Maya Lin**, change Carlos Vega's permission to `Can edit`, switch back to **Carlos Vega**, make an edit, and save.

## 3:25 – 4:00 | Automated Tests & Project Notes
- Open the **Project Notes** tab in the app (or `ARCHITECTURE.md` / `AI_WORKFLOW.md` in the repo) to summarize scope choices and AI workflow.
- In the terminal, run `npm test` to show all automated API, persistence, import, and access-control tests passing.
