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

### Project

There is no plain "Create" operation — every way of creating a project is one of the four below, each a curated subset of fields (everything not shown is fixed to a sensible default and never sent as user input):

- **Managed Translation Project** – creates a project with every target language flagged as agency-managed (`managedProject: true`), no automated process, and no team assignment (the agency handles staffing)
- **In-House Translation Project** – creates a project with every target language flagged as staffed in-house (`managedProject: false`), no automated process, with an optional per-language **Team** and a **Proofreading** toggle
- **Create (Managed Quality Eval)** – creates a project and starts TextUnited's Managed Project Quality Eval process (`processId: 1`): the project is allocated to an agency, which runs terminology-first automatic translation followed by a quality evaluation. A curated operation like the others above — start date is set to now automatically, and a manually assigned **Team** is not offered at all, since TextUnited's own agency allocation overrides (and actively rejects) one. Automatic translation, translation service, and several other fields are likewise fixed rather than exposed.
- **Create (In-House Quality Eval)** – same process, but staffed in-house (`processId: 2`) instead of by an agency: if no **Team** is given, TextUnited assigns a translator from your own Engagement team (matched by language pair), or the project creator if none match. A team can optionally be assigned per target language instead — TextUnited requires it for either every target language or none, and each one must include at least one member with the Translator role. A curated operation like the two Translation Project ones above: start date is set to now automatically, and several fields (automatic/adaptive translation, translation service, description, instant translation) are fixed rather than exposed.
- **Get** – fetches a single project, either by its TextUnited ID (`GET /segments/projects/{id}`) or by your own custom ID (`GET /segments/projects/custom/{customId}`)
- **Get Many** – lists all projects in your company (`GET /segments/projects`), with an optional client-side limit (the API does not paginate this endpoint)
- **Get Segments (Segments Project)** – fetches a project's segments, either by its TextUnited ID (`GET /segments/projects/{id}/segments`) or by your own custom ID (`GET /segments/projects/custom/{customId}/segments`)

All four Create variants call `POST /segments/projects`, and all four offer **Segments** via a **Specify Segments** mode — see below.

### Translation

- **Translate Instantly** – runs pure machine translation on content without creating a project (`POST /segments/Translation`): no name, no team, no project state. Domain, Source Language, and Target Languages apply to the whole request. Also offers **Segments** via **Specify Segments** — see below.

### Specifying Segments

Every operation above that has a **Segments** field offers the same **Specify Segments** mode:

- **One Segment per Input Item** (default) – **the only mode where the operation does not run once per input item like every other operation on this node.** It runs once per *execution* and builds one segment per input item: connect an upstream node that outputs one item per piece of content (e.g. after a Split Out), and set **Content** (plus optionally **Custom ID** and **Notes**) with an expression referencing each item's data. For the four Create operations, this means **one project gets created containing every input item as a segment** — not one project per item.
- **Define Below** – build a fixed list through the UI (the classic "Add Segment" pattern). Runs once per input item, like every other operation — feeding N items creates N projects (or N translate calls), each using this same fixed list.
- **Using JSON** – provide the segments as a JSON array (e.g. from an upstream node). Also runs once per input item.

**This is a real behavior difference to be aware of**: because "One Segment per Input Item" is the default, feeding multiple items into any of these operations **without changing Specify Segments** will create a single aggregated project/translation rather than one per item. Switch to **Define Below** or **Using JSON** if you want the traditional "one item in → one project out" behavior with multiple input items.

### Process

Creating a project via **Create (Managed Quality Eval)** or **Create (In-House Quality Eval)** returns a `processGuid` alongside the project, tracking the automated workflow (agency/in-house allocation, translation, quality evaluation) that was started. Use the Process resource to track and drive it:

- **Get** – fetches the current status, either by the process's own GUID (`GET /ProcessManagement/processes/{processGuid}`) or by the project's ID (`GET /ProcessManagement/processes/project/{projectId}`). The response's `state` field tells you what's happening — see below.
- **Finish Glossary** – call when `state` is `WaitingForGlossaryTranslation`, once your project manager has translated the glossary (`POST /ProcessManagement/processes/{processGuid}/glossary-translated`)
- **Submit Client Review** – call when `state` is `WaitingForClientReview`, with **Approved** set to whether the quality evaluation report is accepted (`POST /ProcessManagement/processes/{processGuid}/client-review`)
- **Retry** – resumes a process whose `state` ends in `Failed` (`POST /ProcessManagement/processes/{processGuid}/retry`)
- **Cancel** – stops a process entirely (`POST /ProcessManagement/processes/{processGuid}/cancel`)

A process ends in the `Completed` state. A 404 on Get means no such process exists; a 401 means it belongs to a different TextUnited tenant than your credential.

## Compatibility

Built and tested against n8n's current node API version (`n8nNodesApiVersion: 1`) using n8n-workflow as a peer dependency. Requires Node.js 20 or later.

## Usage

1. Add a **TextUnited** node to your workflow and select the **TextUnited API** credential.
2. Pick a Resource:
   - **Project → Managed Translation Project** / **In-House Translation Project**: fill in the project name, end date, source language, at least one target language. No automated process is started; the start date is set to now automatically.
   - **Project → Create (Managed Quality Eval)** / **Create (In-House Quality Eval)**: similar core fields, but TextUnited also starts a quality-evaluation process — track it afterwards via the **Process** resource using the `processGuid` from the response.
   - **Project → Get**: pick whether to look the project up by its TextUnited ID or your own custom ID, and enter the value.
   - **Project → Get Many**: leave **Return All** on, or turn it off and set a **Limit**.
   - **Project → Get Segments (Segments Project)**: same ID lookup as **Get**, returning the project's segments instead.
   - **Translation → Translate Instantly**: pick a source language and at least one target language. No project is created; the translated content comes back directly.
   - **Process → Get / Finish Glossary / Submit Client Review / Retry / Cancel**: drive a process started by one of the two Create-with-process operations above.
3. On any operation with a **Segments** field, decide how to specify them via **Specify Segments** (see above) — the default expects one input item per piece of content; switch to **Define Below** or **Using JSON** for a fixed list evaluated once per input item.
4. Run the node.

If you're new to n8n, check out the [Try it out](https://docs.n8n.io/try-it-out/) documentation.

## Example Workflows

### Create a translation project from a spreadsheet, then poll it to completion

A common pattern: turn each row of a spreadsheet (or CRM export, ticket queue, etc.) into a TextUnited project, then check in on it later.

1. **Google Sheets (or any data source) → Read rows** — one row per project to create, with columns for project name, target languages, and content.
2. **Split Out** — if a row lists multiple target languages in one cell, split it into one item per language pair, or leave as-is if using **Specify Segments → Define Below**/**Using JSON**.
3. **TextUnited → Project → Managed Translation Project** — map **Project Name** from the row, add each target language under **Translate Into**, and set **Specify Segments** to **Using JSON** with an expression referencing the row's content column.
4. **Wait** (or a separate scheduled workflow) — TextUnited projects aren't instant; revisit after some time.
5. **TextUnited → Project → Get** — look the project up by the `id` returned from step 3, to check `stateName`/progress.

### Start a quality-evaluation process and react to each stage

TextUnited's Quality Eval flow moves through several `state` values that each need a different action from you.

1. **TextUnited → Project → Create (Managed Quality Eval)** (or **In-House Quality Eval**) — creates the project and kicks off the process; note the response's `processGuid`.
2. **TextUnited → Process → Get** — using that `processGuid`, on a schedule (e.g. a **Schedule Trigger** every 15 minutes) or triggered by a webhook from your own systems.
3. **IF** node branching on the response's `state` field:
   - `WaitingForGlossaryTranslation` → your project manager translates the glossary externally, then **Process → Finish Glossary**.
   - `WaitingForClientReview` → **Process → Submit Client Review** with **Approved** set based on your own review logic.
   - a `*Failed` state → **Process → Retry**, or **Process → Cancel** to stop it entirely.
   - `Completed` → the workflow can fetch the finished project via **Project → Get** and move on (e.g. notify a Slack channel).

## Roadmap

This node intentionally ships with a focused surface first. Planned follow-ups:

- Update a project
- Delete a project
- Get a project's translations and progress (segments are already covered by **Project → Get Segments (Segments Project)**)
- Add comments to segments
- Per-segment language-specific notes on create
- Creating a project from uploaded files (a File → Convert / Project → Create From Files pair, using DocProcessor) — built once already, removed for now while it's finished properly for a future release

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [TextUnited API reference](https://textunited.readme.io/reference/api-reference)
- [TextUnited website](https://www.textunited.com/)
