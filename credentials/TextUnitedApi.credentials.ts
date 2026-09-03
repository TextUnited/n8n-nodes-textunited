import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TextUnitedApi implements ICredentialType {
	name = 'textUnitedApi';

	displayName = 'TextUnited API';

	documentationUrl = 'https://textunited.readme.io/reference/authentication';

	icon: ICredentialType['icon'] = {
		light: 'file:../nodes/TextUnited/textunited.svg',
		dark: 'file:../nodes/TextUnited/textunited.dark.svg',
	};

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.textunited.com',
			required: true,
			description:
				'Root URL of the TextUnited API. Override this to point at a non-production environment (e.g. a dev or staging API).',
		},
		{
			displayName: 'Personal Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			placeholder: 'tu_pat_...',
			description:
				'A personal access token generated in the API section of your TextUnited account. It is only shown once when created, so store it somewhere safe.',
		},
	];

	// TextUnited personal access tokens are sent as a standard Bearer token.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.accessToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/segments/projects',
			method: 'GET',
		},
	};
}
