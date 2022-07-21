browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	if (changeInfo.status == 'loading') {
		const {
			urls: regexMap,
			preferences: { closeExistingTab },
		} = await browser.storage.sync.get({ urls: [], preferences: {} })

		const url = tab.url

		const urlsMatched = regexMap.reduce((matches, current) => {
			if (url.match(current.pattern)) {
				matches.push(current)
			}
			return matches
		}, [])

		if (
			urlsMatched.length > 0 &&
			tab.cookieStoreId === 'firefox-default' &&
			tab.active === true
		) {
			console.debug('URLs matched:', urlsMatched)
			browser.tabs.remove(tab.id)
			browser.tabs.create({
				url,
				cookieStoreId: urlsMatched[0].containerId,
			})
		}
	}
})
