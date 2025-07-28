export class GapiUtils {
	private static gapiScriptLoaded = false;
	private static googleScriptLoaded = false;
	private static gapiClientInit = false;

	private static _isLoggedIn = false;
	private static _googleToken: google.accounts.oauth2.TokenClient;

	static SCOPES = 'https://www.googleapis.com/auth/drive.appdata';

	static ready = () => {return GapiUtils.gapiScriptLoaded && GapiUtils.googleScriptLoaded && GapiUtils.gapiClientInit;};

	private static _callbacks: (() => void)[] = [];
	private static _loggedInCallbacks: (() => void)[] = [];
	private static _loogedOutCallbacks: (() => void)[] = [];

	static isLoggedIn = () => { return GapiUtils._isLoggedIn; };

	static gapiLoaded = () => {
		GapiUtils.gapiScriptLoaded = true;
		gapi.load('client', GapiUtils.initializeGapiClient);
	};
	static gapiUnloaded = () => { GapiUtils.gapiScriptLoaded = false; GapiUtils.gapiClientInit = false;};

	static googleLoaded = () => {
		GapiUtils.googleScriptLoaded = true;
		GapiUtils.checkLoadedCallbacks();
	};
	static googleUnloaded = () => { GapiUtils.googleScriptLoaded = false; };

	static logIn() {
		console.log('login');
		console.log(GapiUtils._googleToken);
		if (gapi.client.getToken() === null) {
			// Prompt the user to select a Google Account and ask for consent to share their data
			// when establishing a new session.
			GapiUtils._googleToken.requestAccessToken({ prompt: '' });
		} else {
			// Skip display of account chooser and consent dialog for an existing session.
			GapiUtils._googleToken.requestAccessToken({ prompt: '' });
		}
	}

	static logOut() {
		const token = gapi.client.getToken();
		if (token !== null) {
			google.accounts.oauth2.revoke(token.access_token, () => {});
			gapi.client.setToken(null);
			GapiUtils._isLoggedIn = false;
			GapiUtils.checkLoggedOutCallbacks();
		}
	}

	static checkLoadedCallbacks = () => {
		if (GapiUtils.ready()) {
			GapiUtils._callbacks.forEach(fn => fn());

			GapiUtils._googleToken = google.accounts.oauth2.initTokenClient({
				client_id: import.meta.env.VITE_CLIENT_ID,
				scope: GapiUtils.SCOPES,
				callback: async resp => {
					if (resp.error !== undefined) {
						throw (resp);
					}
					GapiUtils._isLoggedIn = true;
					GapiUtils.checkLoggedInCallbacks();
				}
			});
		}
	};

	static checkLoggedInCallbacks = () => {
		if(GapiUtils._isLoggedIn) {
			GapiUtils._loggedInCallbacks.forEach(fn => fn());
		}
	};

	static checkLoggedOutCallbacks = () => {
		if(!GapiUtils._isLoggedIn) {
			GapiUtils._loogedOutCallbacks.forEach(fn => fn());
		}
	};

	// This will immediatly call the function if gapi and google is loaded
	// otherwise will store it to be called as soon as loaded
	static callbackOnLoaded(fn: () => void) {
		if (GapiUtils.ready()) {
			fn();
		}

		GapiUtils._callbacks.push(fn);

		if(GapiUtils._callbacks.indexOf(fn) == -1)
			GapiUtils._callbacks.push(fn);
	};

	static callbackOnLoggedIn(fn: () => void) {
		if(GapiUtils._isLoggedIn) {
			fn();
		}

		if(GapiUtils._loggedInCallbacks.indexOf(fn) == -1)
			GapiUtils._loggedInCallbacks.push(fn);
	}

	static callbackOnLoggedOut(fn: () => void) {
		if(!GapiUtils._isLoggedIn) {
			fn();
		}

		if(GapiUtils._loogedOutCallbacks.indexOf(fn) == -1)
			GapiUtils._loogedOutCallbacks.push(fn);
	}

	static initializeGapiClient = async () => {
		await gapi.client.init({
			apiKey: import.meta.env.VITE_GAPI_KEY,
			discoveryDocs: [ 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest' ]
		});
		GapiUtils.gapiClientInit = true;
		GapiUtils.checkLoadedCallbacks();
	};

	static addScript = (src: string, id: string, onLoad: (() => void)) => {
		const existing = document.getElementById(id);
		if (existing) {
			return existing;
		} else {
			const script = document.createElement('script');
			script.src = src;
			script.id = id;
			script.async = true;
			script.onload = () => {
				if (onLoad) {
					onLoad();
				}
			};
			document.body.appendChild(script);
			return script;
		}
	};

	static removeScript = ( id: string ) => {
		const script = document.getElementById(id);
		if (script) {
			document.body.removeChild(script);
		}
	};

	// eslint-disable-next-line  @typescript-eslint/no-explicit-any
	static createFileWithJSONContent = function(metadata: gapi.client.drive.File, data: string, callback: (rawResponse:any) => void) {
		const boundary = '-------314159265358979323846';
		const delimiter = '\r\n--' + boundary + '\r\n';
		const close_delim = '\r\n--' + boundary + '--';

		const contentType = 'application/json';

		const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n\r\n' +
        data +
        close_delim;

		const reqOption: gapi.client.RequestOptions = {
			path: '/upload/drive/v3/files',
			method: 'POST',
			params: { 'uploadType': 'multipart' },
			headers: {
				'Content-Type': 'multipart/related; boundary="' + boundary + '"'
			},
			body: multipartRequestBody
		};


		// The type we import for drive clash with the more recent google client def, so we need to force the type to
		// be HttpRequest and NOT Request, as Request will not have the right execute signature
		const request = gapi.client.request(reqOption);
		request.execute(callback);
	};

	// eslint-disable-next-line  @typescript-eslint/no-explicit-any
	static updateFileWithJSONContent = function(fileId: string, data: string, callback: (rawResponse:any) => void) {

		const request = gapi.client.request({
			path: `/upload/drive/v3/files/${fileId}`,
			method: 'PATCH',
			params: { 'uploadType': 'media' },
			headers: {
				'Content-Type': 'application/json'
			},
			body: data
		});

		request.execute(callback);
	};
}