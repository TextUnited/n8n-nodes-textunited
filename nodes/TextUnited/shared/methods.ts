import type {
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodePropertyOptions,
} from 'n8n-workflow';

import { textUnitedApiRequest } from './transport';
import { withRetry } from './utils';

interface TextUnitedLanguage {
	langCode: string;
	descriptiveName: string;
}

interface TextUnitedDomain {
	id: number;
	name: string;
}

interface TextUnitedCompanyUser {
	id: number;
	firstName: string;
	lastName: string;
	email: string;
}

interface TextUnitedCollaborator {
	userId: number;
	firstName: string;
	lastName: string;
	email: string;
}

interface TextUnitedStyleGuide {
	id: number;
	name: string;
}

interface TextUnitedProjectSummary {
	id: number;
	name: string;
}

/**
 * Populates the source/target language dropdowns from TextUnited's
 * general-purpose language list.
 */
export async function getLanguages(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const languages = (await withRetry.call(this, () =>
		textUnitedApiRequest.call(this, 'GET', '/integrations/languages'),
	)) as unknown as TextUnitedLanguage[];

	return languages
		.map((language) => ({
			name: language.descriptiveName,
			value: language.langCode,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Populates the project domain dropdown from the company's active domains.
 * Domain is optional, so a "none selected" entry is included explicitly —
 * without it, n8n's UI flags the field's empty default as an unsupported
 * value, since it wouldn't otherwise appear anywhere in the returned list.
 */
export async function getDomains(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const domains = (await withRetry.call(this, () =>
		textUnitedApiRequest.call(this, 'GET', '/Assets/api/Domains?active=true'),
	)) as unknown as TextUnitedDomain[];

	const options = domains
		.map((domain) => ({
			name: domain.name,
			value: domain.id,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	return [{ name: '- No Domain -', value: '' }, ...options];
}

/**
 * Populates the team-member dropdown by merging the company's own users
 * (who can be project managers, translators, proofreaders, etc.) with its
 * external collaborators/freelancers. Both lists ultimately identify a
 * TextUnited system user, but under different ID fields: `id` for company
 * users, `userId` for collaborators.
 */
export async function getTeamMembers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	// Fetched independently and tolerated individually: if one of the two
	// endpoints is unavailable (e.g. missing scope on this token), the
	// dropdown should still populate from whichever endpoint did succeed
	// rather than failing outright. Each is also retried once on its own,
	// so a transient failure on one doesn't need to wait for the other.
	const [usersResult, collaboratorsResult] = await Promise.allSettled([
		withRetry.call(this, () =>
			textUnitedApiRequest.call(this, 'GET', '/Accounts/Users'),
		) as unknown as Promise<TextUnitedCompanyUser[]>,
		withRetry.call(this, () =>
			textUnitedApiRequest.call(this, 'GET', '/accounts/Collaborators'),
		) as unknown as Promise<TextUnitedCollaborator[]>,
	]);

	const members = new Map<number, INodePropertyOptions>();

	if (usersResult.status === 'fulfilled') {
		for (const user of usersResult.value) {
			members.set(user.id, {
				name: `${user.firstName} ${user.lastName} (${user.email})`.trim(),
				value: user.id,
			});
		}
	}

	if (collaboratorsResult.status === 'fulfilled') {
		for (const collaborator of collaboratorsResult.value) {
			if (!members.has(collaborator.userId)) {
				members.set(collaborator.userId, {
					name: `${collaborator.firstName} ${collaborator.lastName} (${collaborator.email})`.trim(),
					value: collaborator.userId,
				});
			}
		}
	}

	if (usersResult.status === 'rejected' && collaboratorsResult.status === 'rejected') {
		throw usersResult.reason;
	}

	return [...members.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Populates the style guide dropdown for target languages. Style guide is
 * optional, so a "none selected" entry is included explicitly — see
 * {@link getDomains} for why that matters.
 */
export async function getStyleGuides(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const styleGuides = (await withRetry.call(this, () =>
		textUnitedApiRequest.call(this, 'GET', '/TextProcessing/StyleGuide'),
	)) as unknown as TextUnitedStyleGuide[];

	const options = styleGuides
		.map((styleGuide) => ({
			name: styleGuide.name,
			value: styleGuide.id,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	return [{ name: '- No Style Guide -', value: '' }, ...options];
}

/**
 * Backs the "From List" mode of the Project resourceLocator (Get, Get
 * Segments) with a searchable list of the company's projects, so a project
 * can be picked by name instead of having to already know its numeric
 * TextUnited ID or custom ID. Uses the same endpoint as Get Many.
 */
export async function searchProjects(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const projects = (await withRetry.call(this, () =>
		textUnitedApiRequest.call(this, 'GET', '/segments/projects'),
	)) as unknown as TextUnitedProjectSummary[];

	const results = projects
		.filter(
			(project) => !filter || project.name.toLowerCase().includes(filter.toLowerCase()),
		)
		.map((project) => ({
			name: project.name,
			value: project.id,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	return { results };
}
