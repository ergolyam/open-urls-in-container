const DEFAULT_COOKIE_STORE_ID = 'firefox-default'
const CANCELED_REQUEST_TTL_MS = 2000
const pendingNavigations = new Map()
const canceledRequests = new Map()

function normalizeAssignments(urls) {
	return Array.isArray(urls) ? urls : []
}

let cachedAssignments = []
let assignmentsLoaded = false
let assignmentsLoadPromise = null
let assignmentsRevision = 0

function loadAssignments() {
	if (assignmentsLoaded) {
		return Promise.resolve(cachedAssignments)
	}

	if (!assignmentsLoadPromise) {
		const requestedRevision = assignmentsRevision
		assignmentsLoadPromise = browser.storage.sync.get({ urls: [] })
			.then(({ urls }) => {
				if (requestedRevision === assignmentsRevision) {
					cachedAssignments = normalizeAssignments(urls)
					assignmentsLoaded = true
				}
				return cachedAssignments
			})
			.catch((error) => {
				console.debug('Failed to load URL assignments:', error)
				return cachedAssignments
			})
			.finally(() => {
				assignmentsLoadPromise = null
			})
	}

	return assignmentsLoadPromise
}

browser.storage.sync.onChanged.addListener((changes) => {
	if (changes.urls) {
		assignmentsRevision += 1
		cachedAssignments = normalizeAssignments(changes.urls.newValue)
		assignmentsLoaded = true
	}
})

// Start loading eagerly, but leave the state retryable if storage is
// temporarily unavailable.
loadAssignments()

function isSameTarget(navigation, details) {
	return navigation.url === details.url
}

function isCurrentNavigation(navigation) {
	return (
		navigation.superseded !== true &&
		pendingNavigations.get(navigation.tabId) === navigation
	)
}

function clearCanceledRequests(tabId) {
	const canceledRequest = canceledRequests.get(tabId)
	if (!canceledRequest) {
		return
	}

	clearTimeout(canceledRequest.timeoutId)
	canceledRequests.delete(tabId)
}

function getOrCreateCanceledRequest(tabId) {
	let canceledRequest = canceledRequests.get(tabId)

	if (!canceledRequest) {
		canceledRequest = {
			requestIds: new Set(),
			urls: new Set(),
			timeoutId: null,
		}
		canceledRequests.set(tabId, canceledRequest)
		canceledRequest.timeoutId = setTimeout(() => {
			if (canceledRequests.get(tabId) === canceledRequest) {
				canceledRequests.delete(tabId)
			}
		}, CANCELED_REQUEST_TTL_MS)
	}

	return canceledRequest
}

function rememberCanceledRequest(details) {
	const canceledRequest = getOrCreateCanceledRequest(details.tabId)
	canceledRequest.requestIds.add(details.requestId)
	canceledRequest.urls.add(details.url)
}

function rememberCanceledNavigation(navigation) {
	const canceledRequest = getOrCreateCanceledRequest(navigation.tabId)
	for (const requestId of navigation.requestIds) {
		canceledRequest.requestIds.add(requestId)
	}
	for (const url of navigation.urls) {
		canceledRequest.urls.add(url)
	}
}

function wasRequestCanceled(details) {
	const canceledRequest = canceledRequests.get(details.tabId)
	return Boolean(
		canceledRequest &&
		(
			canceledRequest.requestIds.has(details.requestId) ||
			canceledRequest.urls.has(details.url)
		)
	)
}

async function removeTabQuietly(tabId, errorMessage) {
	try {
		await browser.tabs.remove(tabId)
	} catch (error) {
		console.debug(errorMessage, error)
	}
}

async function preserveTabGroup(tabId, groupId) {
	if (
		typeof groupId !== 'number' ||
		groupId < 0
	) {
		return
	}

	try {
		await browser.tabs.group({
			groupId,
			tabIds: tabId,
		})
	} catch (error) {
		// Keep the container redirect working if the group disappeared while
		// the replacement tab was being created.
		console.debug('Failed to preserve tab group:', error)
	}
}

async function redirectNavigation(details, navigation) {
	let assignments
	try {
		assignments = assignmentsLoaded
			? cachedAssignments
			: await loadAssignments()
	} catch (error) {
		console.debug('Failed to load URL assignments:', error)
		return {}
	}

	if (!isCurrentNavigation(navigation)) {
		return {}
	}

	const firstMatch = assignments.find((assignment) => (
		typeof assignment.pattern === 'string' &&
		details.url.includes(assignment.pattern)
	))

	if (!firstMatch || typeof firstMatch.containerName !== 'string') {
		return {}
	}

	let tab
	try {
		tab = await browser.tabs.get(details.tabId)
	} catch (error) {
		console.debug('Failed to inspect matching navigation:', error)
		return {}
	}

	if (!isCurrentNavigation(navigation)) {
		return {}
	}

	if (tab.cookieStoreId !== DEFAULT_COOKIE_STORE_ID) {
		return {}
	}

	try {
		const containers = await browser.contextualIdentities.query({
			name: firstMatch.containerName,
		})

		if (!isCurrentNavigation(navigation)) {
			return {}
		}

		const container = containers[0]
		const cookieStoreId = container && container.cookieStoreId

		if (!cookieStoreId || typeof cookieStoreId !== 'string') {
			console.debug(`Not replacing tab. cookieStoreId was '${cookieStoreId}'.`)
			return {}
		}

		if (wasRequestCanceled(details)) {
			rememberCanceledRequest(details)
			return { cancel: true }
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

		const createdTab = await browser.tabs.create(createProperties)

		if (!isCurrentNavigation(navigation)) {
			await removeTabQuietly(
				createdTab.id,
				'Failed to remove superseded container tab:',
			)
			return {}
		}

		// A replacement created at the boundary of a Firefox tab group can be
		// placed outside it. Move it explicitly before removing the original,
		// which may be the group's last remaining tab.
		await preserveTabGroup(createdTab.id, tab.groupId)

		if (!isCurrentNavigation(navigation)) {
			await removeTabQuietly(
				createdTab.id,
				'Failed to remove superseded container tab:',
			)
			return {}
		}

		rememberCanceledNavigation(navigation)

		// Start removing the original tab before unblocking the request. The
		// helper handles its own rejection, while the canceled-request registry
		// continues guarding against late duplicate callbacks.
		removeTabQuietly(tab.id, 'Failed to remove replaced tab:')

		return { cancel: true }
	} catch (error) {
		// If the replacement cannot be created, allow the original navigation
		// rather than leaving the user on a canceled request.
		console.debug('Failed to open URL in container:', error)
		return {}
	}
}

async function onBeforeRequest(details) {
	if (details.tabId === -1 || details.frameId !== 0) {
		return {}
	}

	const pendingNavigation = pendingNavigations.get(details.tabId)

	// Reuse a decision only for the same target URL. A redirect can retain its
	// requestId, so requestId alone must not prevent the redirected URL from
	// being evaluated against the assignments.
	if (pendingNavigation && isSameTarget(pendingNavigation, details)) {
		pendingNavigation.requestIds.add(details.requestId)
		pendingNavigation.urls.add(details.url)
		return pendingNavigation.promise
	}

	// A different target in the same tab is either a redirect or newer user
	// intent. Mark the previous operation as stale so only the latest target can
	// replace the tab.
	if (pendingNavigation) {
		pendingNavigation.superseded = true
	}

	const navigation = {
		tabId: details.tabId,
		url: details.url,
		requestIds: new Set([details.requestId]),
		urls: new Set([details.url]),
		superseded: false,
		promise: null,
	}

	pendingNavigations.set(details.tabId, navigation)
	navigation.promise = redirectNavigation(details, navigation)

	try {
		return await navigation.promise
	} finally {
		if (pendingNavigations.get(details.tabId) === navigation) {
			pendingNavigations.delete(details.tabId)
		}
	}
}

function onRequestFinished(details) {
	if (details.tabId !== -1) {
		clearCanceledRequests(details.tabId)
	}
}

const mainFrameRequestFilter = {
	urls: ['<all_urls>'],
	types: ['main_frame'],
}

browser.webRequest.onBeforeRequest.addListener(
	onBeforeRequest,
	mainFrameRequestFilter,
	['blocking'],
)

browser.webRequest.onCompleted.addListener(
	onRequestFinished,
	mainFrameRequestFilter,
)

browser.webRequest.onErrorOccurred.addListener(
	onRequestFinished,
	mainFrameRequestFilter,
)
