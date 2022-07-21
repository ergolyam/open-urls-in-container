<template>
	<div class="row" v-for="url in urls" :key="url.id">
		<div class="col">
			<label>URL pattern: <input type="text" v-model="url.pattern" /></label>
		</div>
		<div class="col">
			<label
				>Container:
				<select v-model="url.containerId">
					<option
						v-for="container in contextualIdentities"
						:key="container.cookieStoreId"
						:value="container.cookieStoreId"
					>
						{{ container.name }}
					</option>
				</select></label
			>
		</div>
	</div>
	<div class="row">
		<button @click="save">Save</button>
		<button @click="addUrl">+</button>
	</div>
</template>

<script>
import { toRaw } from 'vue'
import { v4 as uuid } from 'uuid'

export default {
	data() {
		return {
			urls: [],
			contextualIdentities: [],
			preferences: {},
		}
	},
	async mounted() {
		console.log('Load storage:', await browser.storage.sync.get({ urls: [] }))
		const { urls, preferences } = await browser.storage.sync.get({ urls: [], preferences: {} })
		this.urls = urls
		this.preferences = preferences
		browser.storage.sync.onChanged.addListener(this.syncStorage)
		this.contextualIdentities = await browser.contextualIdentities.query({})
	},
	unmounted() {
		browser.storage.sync.onChanged.addListener(this.syncStorage)
	},
	methods: {
		addUrl() {
			this.urls.push({
				id: uuid(),
				pattern: '',
				containerId: this.contextualIdentities[0].cookieStoreId,
			})
		},
		save() {
			console.debug('Save URLs:', toRaw(this.urls))
			console.debug('Save Preferences:', toRaw(this.preferences))
			browser.storage.sync.set({
				urls: toRaw(this.urls),
				preferences: toRaw(this.preferences),
			})
		},
		syncStorage(changes) {
			console.log('Storage updated:', changes)
			if (changes.urls) {
				this.urls = changes.urls.newValue
			}
			if (changes.preferences) {
				this.preferences = changes.preferences.newValue
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.row {
	display: flex;
	width: 100%;
}
</style>
