import msalConfig from './authConfig.js';

export default class AuthManager {
	#authProvider;
	#notificationManager;
	#graphClient;

	msalClient;
	msalRequest = { scopes: ['user.read', 'mail.read'] };

	constructor(notificationManager) {
		this.#notificationManager = notificationManager;
		this.#authProvider = this.#createAuthProvider();
		this.msalClient = new msal.PublicClientApplication(msalConfig);
		console.log(msalConfig);
		this.#graphClient = MicrosoftGraph.Client.initWithMiddleware({
			authProvider: this.#authProvider,
		});
	}

	#createAuthProvider() {
		return {
			getAccessToken: async () => {
				// Call getToken in auth.js
				return await this.getToken();
			},
		};
	}

	ensureScope(scope) {
		if (
			!this.msalRequest.scopes.some(
				s => s.toLowerCase() === scope.toLowerCase(),
			)
		) {
			this.msalRequest.scopes.push(scope);
		}
	}

	async signIn() {
		try {
			const authResult = await this.msalClient.loginPopup(this.msalRequest);
			sessionStorage.setItem('msalAccount', authResult.account.username);
			this.#notificationManager.showNotification('Login successful!', 'info');
		} catch (error) {
			// Handle sign-in error
			this.#notificationManager.showNotification(error.message, 'error');
			console.error(error);
		}
	}

	async getToken() {
		let account = sessionStorage.getItem('msalAccount');

		if (!account) {
			await this.signIn();
		}

		try {
			// First, attempt to get the token silently
			const silentRequest = {
				scopes: this.msalRequest.scopes,
				account: this.msalClient.getAccountByUsername(account),
			};

			const silentResult = await this.msalClient.acquireTokenSilent(
				silentRequest,
			);

			return silentResult.accessToken;
		} catch (silentError) {
			// If silent requests fail with InteractionRequiredAuthError,
			// attempt to get the token interactively
			if (silentError instanceof msal.InteractionRequiredAuthError) {
				const interactiveResult = await this.msalClient.acquireTokenPopup(
					this.msalRequest,
				);
				return interactiveResult.accessToken;
			} else {
				throw silentError;
			}
		}
	}
	async getUser() {
		try {
			this.ensureScope('user.read');
			const user = await this.#graphClient
				.api('/me')
				.select('id,displayName')
				.get();
			return user;
		} catch (error) {
			console.log(error.message);
			this.#notificationManager.showNotification(
				'Something went wrong, please reload the page!',
				'error',
			);
		}
	}
}
