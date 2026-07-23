const DEFAULT_COOKIE_STORE_ID = 'firefox-default'
const redirectingTabs = new Set()

function normalizeAssignments(urls) {
	return Array.isArray(urls) ? urls : []
}

let assignmentsPromise = browser.storage.sync.get({ urls: [] })
	.then(({ urls }) => normalizeAssignments(urls))
	.catch((error) => {
		console.debug('Failed to load URL assignments:', error)
		return []
	})

browser.storage.sync.onChanged.addListener((changes) => {
	if (changes.urls) {
		assignmentsPromise = Promise.resolve(normalizeAssignments(changes.urls.newValue))
	}
})

async function onBeforeRequest(details) {
	if (details.tabId === -1 || details.frameId !== 0) {
		return {}
	}

	// Firefox may deliver the same request again when another blocking listener
	// redirects it. Keep canceling it without opening duplicate container tabs.
	if (redirectingTabs.has(details.tabId)) {
		return { cancel: true }
	}

	let tab
	let assignments
	try {
		const navigationState = await Promise.all([
			browser.tabs.get(details.tabId),
			assignmentsPromise,
		])
		tab = navigationState[0]
		assignments = navigationState[1]
	} catch (error) {
		console.debug('Failed to inspect navigation:', error)
		return {}
	}

	if (
		tab.cookieStoreId !== DEFAULT_COOKIE_STORE_ID ||
		tab.active !== true
	) {
		return {}
	}

	const firstMatch = assignments.find((assignment) => (
		typeof assignment.pattern === 'string' &&
		details.url.includes(assignment.pattern)
	))

	if (!firstMatch || typeof firstMatch.containerName !== 'string') {
		return {}
	}

	if (redirectingTabs.has(details.tabId)) {
		return { cancel: true }
	}
	redirectingTabs.add(details.tabId)

	try {
		const containers = await browser.contextualIdentities.query({
			name: firstMatch.containerName,
		})
		const container = containers[0]
		const cookieStoreId = container && container.cookieStoreId

		if (!cookieStoreId || typeof cookieStoreId !== 'string') {
			console.debug(`Not replacing tab. cookieStoreId was '${cookieStoreId}'.`)
			return {}
		}

		const createProperties = {
			url: details.url,
			cookieStoreId,
			windowId: tab.windowId,
			index: tab.index + 1,
			active: tab.active,
		}

		// If the original tab is removed, keep its opener instead of pointing the
		// replacement at a tab that is about to disappear.
		if (typeof tab.openerTabId === 'number') {
			createProperties.openerTabId = tab.openerTabId
		}

		await browser.tabs.create(createProperties)

		try {
			await browser.tabs.remove(tab.id)
		} catch (error) {
			console.debug('Failed to remove replaced tab:', error)
		}

		return { cancel: true }
	} catch (error) {
		// If the replacement cannot be created, allow the original navigation
		// rather than leaving the user on a canceled request.
		console.debug('Failed to open URL in container:', error)
		return {}
	} finally {
		redirectingTabs.delete(details.tabId)
	}
}

browser.webRequest.onBeforeRequest.addListener(
	onBeforeRequest,
	{ urls: ['<all_urls>'], types: ['main_frame'] },
	['blocking'],
)
