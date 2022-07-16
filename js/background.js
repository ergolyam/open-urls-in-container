// TODO: Add settings and storage - https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Implement_a_settings_page

browser.tabs.onCreated.addListener(() => {
	console.log('onCreated')
})

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	// console.log('---- onUpdated ----')
	// console.log('tab', tab)
	// console.log('changeInfo', changeInfo)

	if (changeInfo.status == 'loading') {
		const regexMap = [
			{ pattern: 'bitbucket.org/barrenjoeytech', containerId: 'firefox-container-1' },
		]

		// const cookieStores = await browser.cookies.getAllCookieStores()
		// console.log('cookieStores', cookieStores)

		const url = tab.url

		const urlsMatched = regexMap.reduce((matches, current) => {
			if (url.match(current.pattern)) {
				matches.push(current)
			}
			return matches
		}, [])

		// console.log('urlsMatched', urlsMatched)
		// console.log('tab.cookieStoreId', tab.cookieStoreId)
		if (urlsMatched.length > 0 && tab.cookieStoreId == 'firefox-default') {
			// console.log('Do it!')
			browser.tabs.remove(tab.id)
			browser.tabs.create({
				url,
				cookieStoreId: urlsMatched[0].containerId,
			})
		}
	}
})
