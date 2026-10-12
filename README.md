# @textunited/n8n-nodes-textunited

This is an n8n community node that lets you use [TextUnited](https://www.textunited.com/) in your n8n workflows.

TextUnited is a translation management platform. This node currently covers **creating and reading translation projects** from n8n — further operations (updating, deleting, translation progress, comments, etc.) are planned; see [Roadmap](#roadmap).

[n8n](https://n8n.io/) is a fair-code licensed workflow automation platform.

[Installation](#installation)
[Credentials](#credentials)
[Operations](#operations)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)
[Roadmap](#roadmap)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) and enter `@textunited/n8n-nodes-textunited` under **Settings > Community Nodes > Install**.

## Credentials

This node uses the **TextUnited API** credential type, authenticating with a **personal access token** sent as a Bearer token.

1. Have a TextUnited account with API access enabled on your plan.
2. In TextUnited, open the **API** section of your account and generate a personal access token (it looks like `tu_pat_...`). Copy it immediately — TextUnited only shows it once.
3. In n8n, create a new **TextUnited API** credential and paste the token into the **Personal Access Token** field.
4. **Base URL** defaults to `https://api.textunited.com` (production). Only change this if TextUnited has given you a different API environment to use (e.g. a staging or dev API).

See TextUnited's [authentication reference](https://textunited.readme.io/reference/authentication) for details.

## Operations

This node splits translation work into six resources, by what you're translating and how:

- **File** – prepare uploaded files for translation
- **File-Based Project** – create/read a TextUnited project from those prepared files
- **Text-Based Project** – create/read a TextUnited project from content you pass in directly
- **General Project** – look up any project regardless of how it was created
- **Instant Translation** – translate content or files immediately, without creating a project at all
- **Process** – track and drive the automated Quality Eval process a project-creation call started

### File

- **Convert** – uploads one or more files to DocProcessor (`POST /docprocessor/Convert/old`), preparing them for either a **File-Based Project** create operation or **Instant Translation**'s file-based operations. Every run creates a new document batch: all files converted in it share one auto-generated ID, returned in the output as `DocumentBatchId` — DocProcessor's main identifier — and is what those later operations call **Document Batch ID**.

### File-Based Project

Creates a project from files already prepared with **File → Convert**, referencing them by that step's **Document Batch ID**.

- **Create From Files (In-House)** – every target language staffed in-house, with an optional per-language **Team**
- **Create From Files (Managed)** – every target language handed to the same agency; **Team** is not offered, since agency allocation overrides it
- **Create From Files (In-House Quality Eval)** / **(Managed Quality Eval)** – the same two variants, but they start TextUnited's `InHouseFileProjectQualityEval` / `ManagedFileProjectQualityEval` process: after machine translation a quality report is produced, and **Critical Translation** decides what happens next (see below). The process never waits for a glossary to be translated (`PrepareGlossaryTranslation` is always `false`) — it goes straight to machine translation.
- **Download Translated Files** – downloads the finished project's translated files as a ZIP (`GET /projects/{projectId}/documents/translated`), decoding the response's base64 `content` into binary data on the output item. Throws a clear error if the files aren't ready yet (no `content` in the response). See [Example Workflows](#example-workflows) below for returning it directly to a webhook caller.

All four Create variants call `POST /projects/automation/multilingual`; they differ in `ProcessName` (and, for the Quality Eval ones, a `ProcessSettings` block). Waiting for the result and downloading it work the same as for the plain variants — wait for the project to finish (track it via **Process → Get**, by project ID or process GUID), then fetch it with **Download Translated Files**.

**Critical Translation** (all four Quality Eval variants, file-based and text-based; off by default) sets `ProcessSettings.AfterQualityReport` (`processSettings.afterQualityReport` on the text-based API):

- **On** → `FollowReport`: if the quality report finds risks, TextUnited assigns a translator to fix them automatically and re-runs the report afterwards. No risks → the project completes immediately; risks still present after the corrections → the manager and client are emailed and the process closes.
- **Off** → `AlwaysComplete`: the project always ends after machine translation, even if the report finds risks. The report stays available to review.

### Text-Based Project

Creates a project from content (segments) you pass in directly — no file upload involved. Every way of creating one is one of the four below, each a curated subset of fields (everything not shown is fixed to a sensible default and never sent as user input):

- **Managed Translation Project** – every target language flagged as agency-managed (`managedProject: true`), no automated process, and no team assignment (the agency handles staffing)
- **In-House Translation Project** – every target language flagged as staffed in-house (`managedProject: false`), no automated process, with an optional per-language **Team** and a **Proofreading** toggle
- **Create (Managed Quality Eval)** – starts TextUnited's Managed Project Quality Eval process (`processId: 1`): the project is allocated to an agency, which runs terminology-first automatic translation followed by a quality evaluation. A curated operation like the others above — start date is set to now automatically, and a manually assigned **Team** is not offered at all, since TextUnited's own agency allocation overrides (and actively rejects) one. Automatic translation, translation service, and several other fields are likewise fixed rather than exposed. Has the same **Critical Translation** toggle as the file-based Quality Eval variants (sent as `processSettings.afterQualityReport`).
- **Create (In-House Quality Eval)** – same process, but staffed in-house (`processId: 2`) instead of by an agency: if no **Team** is given, TextUnited assigns a translator from your own Engagement team (matched by language pair), or the project creator if none match. A team can optionally be assigned per target language instead — TextUnited requires it for either every target language or none, and each one must include at least one member with the Translator role. A curated operation like the two Translation Project ones above: start date is set to now automatically, and several fields (automatic/adaptive translation, translation service, description, instant translation) are fixed rather than exposed. Has the same **Critical Translation** toggle as the file-based Quality Eval variants (sent as `processSettings.afterQualityReport`).
- **Get Segments (Segments Project)** – fetches a project's segments, either by its TextUnited ID (`GET /segments/projects/{id}/segments`) or by your own custom ID (`GET /segments/projects/custom/{customId}/segments`)

All four Create variants call `POST /segments/projects`, and all four offer **Segments** via a **Specify Segments** mode — see below.

### General Project

- **Get** – fetches a single project by its TextUnited ID (`GET /segments/projects/{id}`) or your own custom ID (`GET /segments/projects/custom/{customId}`) — works for a project created via any of the operations above, file-based or text-based.

### Instant Translation

Translate right away, with no TextUnited project ever created.

- **Translate Instantly** – runs pure machine translation on content (`POST /segments/Translation`): no name, no team, no project state. Domain, Source Language, and Target Languages apply to the whole request. Also offers **Segments** via **Specify Segments** — see below.
- **Start Machine Translation** – kicks off machine translation on files already prepared with **File → Convert**, under the same **Document Batch ID** (`POST /docprocessor/DocumentBatchTranslation`), for one source language into one or more target languages. Runs in the background on TextUnited's side; this call only starts it, returning a process object (`processGuid`, `state`, ...) — the same shape as the **Process** resource.
  - Check progress via **Process → Get**, using the `processGuid` from this response — no dedicated operation for this here, it reuses the **Process** resource. Meant to be polled — TextUnited suggests every ~10 seconds with your own timeout (e.g. 30 minutes) — until `state` is `Completed` (or a `*Failed` state).
- **Download Machine Translation** – once `state` is `Completed`, downloads the result as a ZIP (`GET /docprocessor/DocumentBatchTranslationDownload/{documentBatchId}`), with a separate folder per target language (a translated PDF comes back named `<file>.pdf.docx`). A 404 means it isn't finished yet; a 410 means more than a day has passed since it did and the files are already gone — TextUnited only keeps this ZIP for one day. Unzip it with n8n's built-in **Compression** node if you need the individual files rather than the archive.

See [Example Workflows](#example-workflows) below for the full file-based on-the-fly flow, including how to poll status without a blocking wait.

### Specifying Segments

Every operation above that has a **Segments** field offers the same **Specify Segments** mode:

- **One Segment per Input Item** (default) – **the only mode where the operation does not run once per input item like every other operation on this node.** It runs once per *execution* and builds one segment per input item: connect an upstream node that outputs one item per piece of content (e.g. after a Split Out), and set **Content** (plus optionally **Custom ID** and **Notes**) with an expression referencing each item's data. For the four Create operations, this means **one project gets created containing every input item as a segment** — not one project per item.
- **Define Below** – build a fixed list through the UI (the classic "Add Segment" pattern). Runs once per input item, like every other operation — feeding N items creates N projects (or N translate calls), each using this same fixed list.
- **Using JSON** – provide the segments as a JSON array (e.g. from an upstream node). Also runs once per input item.

**This is a real behavior difference to be aware of**: because "One Segment per Input Item" is the default, feeding multiple items into any of these operations **without changing Specify Segments** will create a single aggregated project/translation rather than one per item. Switch to **Define Below** or **Using JSON** if you want the traditional "one item in → one project out" behavior with multiple input items.

### Process

Two things return a `processGuid` to track here: creating a project via **Text-Based Project → Create (Managed Quality Eval)** / **Create (In-House Quality Eval)**, or starting a translation via **Instant Translation → Start Machine Translation**.

- **Get** – fetches the current status, either by the process's own GUID (`GET /ProcessManagement/processes/{processGuid}`) or by the project's ID (`GET /ProcessManagement/processes/project/{projectId}`). The response's `state` field tells you what's happening — see below.
- **Retry** – resumes a process whose `state` ends in `Failed` (`POST /ProcessManagement/processes/{processGuid}/retry`)
- **Cancel** – stops a process entirely (`POST /ProcessManagement/processes/{processGuid}/cancel`)

A process ends in the `Completed` state. A 404 on Get means no such process exists; a 401 means it belongs to a different TextUnited tenant than your credential.

## Compatibility

Built and tested against n8n's current node API version (`n8nNodesApiVersion: 1`) using n8n-workflow as a peer dependency. Requires Node.js 20 or later.

## Usage

1. Add a **TextUnited** node to your workflow and select the **TextUnited API** credential.
2. Pick a Resource:
   - **File → Convert**: upload files to prepare them, before either a File-Based Project create operation or Instant Translation's file-based operations.
   - **File-Based Project → Create From Files (In-House)** / **(Managed)** (or their **Quality Eval** versions): reference the **Document Batch ID** from a Convert run.
   - **File-Based Project → Download Translated Files**: fetch a finished project's translated files as a ZIP.
   - **Text-Based Project → Managed Translation Project** / **In-House Translation Project**: fill in the project name, end date, source language, at least one target language. No automated process is started; the start date is set to now automatically.
   - **Text-Based Project → Create (Managed Quality Eval)** / **Create (In-House Quality Eval)**: similar core fields, but TextUnited also starts a quality-evaluation process — track it afterwards via the **Process** resource using the `processGuid` from the response.
   - **Text-Based Project → Get Segments (Segments Project)**: pick whether to look the project up by its TextUnited ID or your own custom ID, and enter the value.
   - **General Project → Get**: same ID lookup, for a single project regardless of how it was created.
   - **Instant Translation → Translate Instantly**: pick a source language and at least one target language. No project is created; the translated content comes back directly.
   - **Instant Translation → Start Machine Translation** / **Download Machine Translation**: the file-based equivalent, referencing a Convert run's **Document Batch ID**; track progress via **Process → Get**.
   - **Process → Get / Retry / Cancel**: drive a process started by a Quality Eval create operation or Start Machine Translation.
3. On any operation with a **Segments** field, decide how to specify them via **Specify Segments** (see above) — the default expects one input item per piece of content; switch to **Define Below** or **Using JSON** for a fixed list evaluated once per input item.
4. Run the node.

If you're new to n8n, check out the [Try it out](https://docs.n8n.io/try-it-out/) documentation.

## Example Workflows

### Create a translation project from a spreadsheet, then poll it to completion

A common pattern: turn each row of a spreadsheet (or CRM export, ticket queue, etc.) into a TextUnited project, then check in on it later.

1. **Google Sheets (or any data source) → Read rows** — one row per project to create, with columns for project name, target languages, and content.
2. **Split Out** — if a row lists multiple target languages in one cell, split it into one item per language pair, or leave as-is if using **Specify Segments → Define Below**/**Using JSON**.
3. **TextUnited → Text-Based Project → Managed Translation Project** — map **Project Name** from the row, add each target language under **Translate Into**, and set **Specify Segments** to **Using JSON** with an expression referencing the row's content column.
4. **Wait** (or a separate scheduled workflow) — TextUnited projects aren't instant; revisit after some time.
5. **TextUnited → General Project → Get** — look the project up by the `id` returned from step 3, to check `stateName`/progress.

### Start a quality-evaluation process and react to each stage

TextUnited's Quality Eval flow moves through several `state` values. **Process** currently only exposes **Get**, **Retry**, and **Cancel** — a process that reaches `WaitingForClientReview` has to be advanced outside this node (e.g. directly in TextUnited) until that action is added back. Processes started by this node never wait for a glossary (they go straight to machine translation), so `WaitingForGlossaryTranslation` shouldn't come up.

1. **TextUnited → Text-Based Project → Create (Managed Quality Eval)** (or **In-House Quality Eval**) — creates the project and kicks off the process; note the response's `processGuid`.
2. **TextUnited → Process → Get** — using that `processGuid`, on a schedule (e.g. a **Schedule Trigger** every 15 minutes) or triggered by a webhook from your own systems.
3. **IF** node branching on the response's `state` field:
   - a `*Failed` state → **Process → Retry**, or **Process → Cancel** to stop it entirely.
   - `Completed` → the workflow can fetch the finished project via **General Project → Get** and move on (e.g. notify a Slack channel).
   - anything else (including `WaitingForClientReview`) → still in progress; loop back to step 2 (e.g. via a **Wait** node) rather than continuing.

### Let a webhook caller download a project's translated files

Serve the ZIP straight back as an HTTP response, with no need for the caller to touch n8n's UI.

1. **Webhook** trigger — in its settings, set **Respond** to **Using 'Respond to Webhook' Node** (not "Immediately"), so the workflow controls the response instead of n8n answering right away.
2. **TextUnited → File-Based Project → Download Translated Files** — pick the project (e.g. from the webhook's query/body). Fails clearly if the translation isn't ready yet.
3. **Respond to Webhook** — set **Respond With** to **Binary File** and **Input Field Name** to `data` (this operation's binary output field). The filename and `Content-Disposition` header are set automatically from TextUnited's response.

### Translate an uploaded file on the fly and return the result

No TextUnited project is created for this flow — a webhook caller uploads a file and gets the translated ZIP straight back, using **File → Convert** plus **Instant Translation**'s file-based operations and the **Process** resource for status. The tricky part is the status check: it needs polling, but a workflow shouldn't just sleep in a loop, so a **Wait** node hands control back to n8n between checks instead of blocking.

1. **Webhook** trigger, set to accept a binary file upload — same as above, set **Respond** to **Using 'Respond to Webhook' Node**.
2. **TextUnited → File → Convert** — converts the uploaded file; note the output's **Document Batch ID** (auto-generated for each run).
3. **TextUnited → Instant Translation → Start Machine Translation** — same **Document Batch ID** from step 2, pick **Source Language** and one or more **Target Languages**. Note the response's **processGuid**.
4. **Loop**: **Wait** node (e.g. 10 seconds) → **TextUnited → Process → Get** (that **processGuid**) → **IF** node on the response's `state`:
   - not yet finished (e.g. `Translating`) → loop back to the **Wait** node.
   - `Completed` → continue to step 5.
   - a `*Failed` state → handle the failure (e.g. **Respond to Webhook** with an error message) instead of continuing.
   - Give this loop its own limit (e.g. a counter compared against a max iteration count) — TextUnited suggests capping at around 30 minutes total, since a service restart on their end can otherwise leave a process stuck mid-state forever.
5. **TextUnited → Instant Translation → Download Machine Translation** — same **Document Batch ID** from step 2; downloads the finished ZIP. Only kept by TextUnited for one day, so download it promptly once Completed.
6. **Respond to Webhook** — **Respond With**: **Binary File**, **Input Field Name**: `data`.

## Roadmap

This node intentionally ships with a focused surface first. Planned follow-ups:

- Update a project
- Delete a project
- Get a project's translations and progress (segments are already covered by **Text-Based Project → Get Segments (Segments Project)**)
- Add comments to segments
- Per-segment language-specific notes on create
- Restore **Process → Finish Glossary** and **Submit Client Review**, needed to advance a Quality Eval process past `WaitingForClientReview` (and `WaitingForGlossaryTranslation`, if a glossary-waiting option is ever exposed)
- A file-based Quality Eval flow (**File-Based Project** currently only offers plain translation, no automated process)

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [TextUnited API reference](https://textunited.readme.io/reference/api-reference)
- [TextUnited website](https://www.textunited.com/)
