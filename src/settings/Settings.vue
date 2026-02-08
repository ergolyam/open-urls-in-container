<template>
	<div class="panel">
			<div v-if="view === 'containers'" class="menu-panel">
				<h3 class="title"><span class="title-text ellipsis">Manage URLs in Containers</span></h3>
			<hr>
			<div class="scrollable identities-list">
				<table class="menu menu--containers" id="picker-identities-list">
					<tr
						v-for="container in containerRows"
						:key="container.cookieStoreId"
						class="menu-item hover-highlight keyboard-nav"
						tabindex="0"
						@click="openContainer(container.name)"
						@keydown.enter.prevent="openContainer(container.name)"
					>
						<td>
							<div class="menu-icon hover-highlight">
								<div
									class="usercontext-icon"
									:data-identity-icon="container.icon"
									:data-identity-color="container.color"
								></div>
							</div>
							<span class="menu-text ellipsis" :title="tooltipText(container.name, 22)">
								{{ container.name }}
							</span>
							<span class="menu-right-float">
								<span class="container-count">{{ container.assignmentCount }}</span>
								<span class="menu-arrow">
									<img alt="" src="/img/arrow-icon-right.svg">
								</span>
							</span>
						</td>
					</tr>
				</table>
			</div>
		</div>

				<div v-else class="menu-panel edit-container-assignments">
					<h3 class="title" :class="{ 'title--reserve-back': isLikelyTruncated(selectedContainerName, 20) }">
						<span class="title-text ellipsis" :title="tooltipText(selectedContainerName, 20)">
							{{ selectedContainerName }}
						</span>
					</h3>
			<button
				class="btn-return arrow-left controller"
				type="button"
				id="close-container-assignment-panel"
				@click="backToContainers"
				aria-label="Back"
			></button>
			<hr>
			<div class="assignment-input-wrap">
				<label for="assignment-pattern-input" class="hide-label">Add site URL or pattern</label>
				<div class="assignment-input-row">
					<input
						id="assignment-pattern-input"
						type="text"
						v-model="newPattern"
						:placeholder="newPatternPlaceholder"
						@keydown.enter.prevent="addUrl"
					>
					<button class="button primary" type="button" @click="addUrl" :disabled="!canAddAssignment">
						Add
					</button>
				</div>
			</div>
			<div class="scrollable edit-sites-assigned">
				<div class="sub-header">Sites assigned to this container</div>
				<table class="menu menu--assignments" id="edit-sites-assigned" :hidden="selectedUrls.length === 0">
					<tr v-for="url in selectedUrls" :key="url.id" class="menu-item hover-highlight">
						<td>
							<div class="favicon">
								<span class="favicon-dot"></span>
							</div>
							<span class="menu-text menu-text--url ellipsis" :title="tooltipText(url.pattern, 36)">
								{{ url.pattern }}
							</span>
							<img
								title="Delete site assignment"
								class="trash-button delete-assignment"
								src="/img/container-delete.svg"
								alt="Delete"
								@click="removeUrl(url.id)"
							>
						</td>
					</tr>
				</table>
				<div v-if="selectedUrls.length === 0" class="empty-state">No sites assigned yet.</div>
			</div>
		</div>
	</div>
</template>

<script>
import { v4 as uuid } from 'uuid'

export default {
	data() {
		return {
			view: 'containers',
			urls: [],
			contextualIdentities: [],
			selectedContainerName: '',
			newPattern: '',
			currentTabUrl: '',
		}
	},
	computed: {
		containerRows() {
			return this.contextualIdentities.map((container) => ({
				...container,
				assignmentCount: this.urls.filter((url) => url.containerName === container.name).length,
			}))
		},
		selectedUrls() {
			return this.urls
				.filter((url) => url.containerName === this.selectedContainerName)
				.slice()
				.reverse()
		},
		effectivePattern() {
			const trimmed = this.newPattern.trim()
			if (trimmed.length > 0) {
				return trimmed
			}
			return this.currentTabUrl
		},
		newPatternPlaceholder() {
			return this.currentTabUrl || 'https://example.com'
		},
		canAddAssignment() {
			return this.selectedContainerName.length > 0 && this.effectivePattern.length > 0
		},
	},
	async mounted() {
		const { urls } = await browser.storage.sync.get({ urls: [] })
		this.urls = Array.isArray(urls) ? urls : []
		this.contextualIdentities = await browser.contextualIdentities.query({})
		browser.storage.sync.onChanged.addListener(this.syncStorage)
		await this.loadCurrentTabUrl()
	},
	unmounted() {
		browser.storage.sync.onChanged.removeListener(this.syncStorage)
	},
	methods: {
		async loadCurrentTabUrl() {
			try {
				const tabs = await browser.tabs.query({ active: true, currentWindow: true })
				if (!tabs || tabs.length === 0) {
					return
				}
				const url = tabs[0].url || ''
				if (this.isUsableUrl(url)) {
					this.currentTabUrl = url
				}
			} catch (error) {
				console.debug('Failed to read current tab URL:', error)
			}
		},
		isUsableUrl(url) {
			return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
		},
		tooltipText(value, threshold) {
			if (typeof value !== 'string') {
				return ''
			}
			if (!this.isLikelyTruncated(value, threshold)) {
				return ''
			}
			return value
		},
		isLikelyTruncated(value, threshold) {
			if (typeof value !== 'string') {
				return false
			}
			return typeof threshold === 'number' && threshold > 0 && value.length > threshold
		},
		openContainer(containerName) {
			this.selectedContainerName = containerName
			this.newPattern = ''
			this.view = 'assignments'
		},
		backToContainers() {
			this.view = 'containers'
			this.newPattern = ''
		},
		async addUrl() {
			if (!this.canAddAssignment) {
				return
			}
			this.urls.push({
				id: uuid(),
				pattern: this.effectivePattern,
				containerName: this.selectedContainerName,
			})
			this.newPattern = ''
			await this.persistUrls()
		},
		async removeUrl(id) {
			this.urls = this.urls.filter((url) => url.id !== id)
			await this.persistUrls()
		},
		async persistUrls() {
			await browser.storage.sync.set({
				urls: this.urls,
			})
		},
		syncStorage(changes) {
			if (changes.urls) {
				this.urls = Array.isArray(changes.urls.newValue) ? changes.urls.newValue : []
			}
		},
	},
}
</script>
