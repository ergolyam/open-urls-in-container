<template>
	<div class="panel">
		<section class="cbi-section">
			<div class="cbi-dynlist" data-dynlist>
				<div class="add-item">
					<label class="field">
						<span class="field-label">Domain pattern</span>
						<input
							type="text"
							v-model="newPattern"
							:placeholder="newPatternPlaceholder"
						/>
					</label>
					<label class="field">
						<span class="field-label">Container</span>
						<select v-model="newContainerName">
							<option
								v-for="container in contextualIdentities"
								:key="container.cookieStoreId"
								:value="container.name"
							>
								{{ container.name }}
							</option>
						</select>
					</label>
					<button
						class="cbi-button cbi-button-add"
						type="button"
						@click="addUrl"
						:disabled="!canAdd"
					>
						Add
					</button>
				</div>

				<div v-if="urls.length === 0" class="empty-state">No rules yet.</div>

				<div class="item" v-for="url in reversedUrls" :key="url.id">
					<div class="item-fields">
						<label class="field">
							<span class="field-label">Domain pattern</span>
							<input
								type="text"
								v-model="url.pattern"
								placeholder="example.com"
								readonly
							/>
						</label>
						<label class="field">
							<span class="field-label">Container</span>
							<select v-model="url.containerName">
								<option
									v-for="container in contextualIdentities"
									:key="container.cookieStoreId"
									:value="container.name"
								>
									{{ container.name }}
								</option>
							</select>
						</label>
					</div>
					<button class="cbi-button cbi-button-remove" type="button" @click="removeUrl(url.id)">
						Delete
					</button>
				</div>
			</div>
		</section>

		<div class="actions">
			<button class="cbi-button cbi-button-save important" type="button" @click="save">Save</button>
		</div>
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
			newPattern: '',
			newContainerName: '',
			currentTabUrl: '',
		}
	},
	computed: {
		canAdd() {
			return this.effectivePattern.length > 0 && this.newContainerName.length > 0
		},
		effectivePattern() {
			const trimmed = this.newPattern.trim()
			if (trimmed.length > 0) {
				return trimmed
			}
			return this.currentTabUrl
		},
		newPatternPlaceholder() {
			return this.currentTabUrl || 'example.com'
		},
		reversedUrls() {
			return [...this.urls].reverse()
		},
	},
	async mounted() {
		console.debug('Load storage:', await browser.storage.sync.get({ urls: [] }))
		const { urls } = await browser.storage.sync.get({ urls: [] })
		this.urls = urls
		browser.storage.sync.onChanged.addListener(this.syncStorage)
		this.contextualIdentities = await browser.contextualIdentities.query({})
		if (!this.newContainerName && this.contextualIdentities.length > 0) {
			this.newContainerName = this.contextualIdentities[0].name
		}
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
		addUrl() {
			if (!this.canAdd) {
				return
			}
			this.urls.push({
				id: uuid(),
				pattern: this.effectivePattern,
				// Use name as assumed unique container identifier, as this is how the Multi-Account
				// Containers extension handles uniqueness when syncing
				// See https://github.com/mozilla/multi-account-containers/blob/e5fa98d69e317b52b7ab107545f8ffdeb7b753a5/src/js/background/sync.js#L329
				containerName: this.newContainerName,
			})
			this.newPattern = ''
		},
		removeUrl(id) {
			this.urls = this.urls.filter((url) => url.id !== id)
		},
		async save() {
			console.debug('Save URLs:', toRaw(this.urls))
			// TODO: If any URL patterns are empty, remove them
			await browser.storage.sync.set({
				urls: toRaw(this.urls),
			})
			if (typeof window !== 'undefined' && window.close) {
				window.close()
			}
		},
		syncStorage(changes) {
			console.debug('Storage updated:', changes)
			if (changes.urls) {
				this.urls = changes.urls.newValue
			}
		},
	},
}
</script>

<style lang="scss" scoped>
:global(:root) {
	--panel-main-bright: #0060df;
	--panel-main-dark: #054096;
	--panel-secondary-bright: #fbfbfe;
	--panel-secondary-dark: #f0f0f4;
	--panel-danger: #e22850;
	--panel-danger-hover: #c50042;
	--panel-danger-active: #810220;
	--panel-success: #0060df;
	--panel-action: #0060df;
	--panel-action-hover: #0250bb;
	--panel-action-active: #054096;
	--panel-border: #e0e0e6;
	--panel-border-strong: #8f8f9d;
	--panel-text: #15141a;
	--panel-muted: #4a4a4f;
	--panel-bg: #ffffff;
	--panel-panel-bg: #ffffff;
	--panel-item-bg: #f0f0f4;
	--panel-input-bg: #ffffff;
	--panel-input-border: #8f8f9d;
	--panel-shadow: rgba(0, 0, 0, 0.12);
	--panel-button-bg: #f0f0f4;
	--panel-button-hover: #e0e0e6;
	--panel-button-active: #cfcfd8;
	--panel-focus: #0060df;
}

:global(body) {
	margin: 0;
	background: var(--panel-bg);
	color: var(--panel-text);
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
		Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
	min-width: 360px;
}

@media (prefers-color-scheme: dark) {
	:global(:root) {
		--panel-text: #fbfbfe;
		--panel-muted: #b1b1b3;
		--panel-bg: #42404c;
		--panel-panel-bg: #42414d;
		--panel-item-bg: #2b2a33;
		--panel-input-bg: #2b2a33;
		--panel-input-border: #8f8f9d;
		--panel-shadow: rgba(0, 0, 0, 0.45);
		--panel-secondary-bright: #2b2a33;
		--panel-secondary-dark: #15141a;
		--panel-action: #00ddff;
		--panel-action-hover: #80ebff;
		--panel-action-active: #aaf2ff;
		--panel-success: #00ddff;
		--panel-button-bg: #2b2a33;
		--panel-button-hover: #52525e;
		--panel-button-active: #5b5b66;
		--panel-focus: #00ddff;
		--panel-danger: #ff8480;
		--panel-danger-hover: #ffbdc5;
		--panel-danger-active: #ffdfe7;
	}
}

.panel {
	padding: 10px 14px;
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding-bottom: 10px;
}

.panel-header {
	background: transparent;
	color: var(--panel-text);
	padding: 12px 14px;
	border-radius: 4px;
	box-shadow: none;
}

.panel-title {
	font-weight: bold;
	font-size: 16px;
}

.panel-subtitle {
	font-size: 12px;
	opacity: 0.9;
}

.cbi-section {
	background: var(--panel-panel-bg);
	border: none;
	border-radius: 4px;
	box-shadow: none;
	padding: 12px;
}

.cbi-section-title {
	display: flex;
	align-items: center;
	gap: 8px;
	font-weight: bold;
	color: var(--panel-text);
	margin-bottom: 10px;
}

.cbi-dynlist {
	height: auto;
	min-height: 30px;
	min-width: 210px;
	max-width: 100%;
	width: auto;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.cbi-dynlist > .item {
	background: var(--panel-item-bg);
	padding: 10px;
	border: 1px outset var(--panel-input-border);
	border-radius: 3px;
	display: grid;
	gap: 10px;
}

.item-fields {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 10px;
	flex: 1;
}

.field {
	display: flex;
	flex-direction: column;
	gap: 6px;
	font-size: 12px;
	color: var(--panel-muted);
}

.field-label {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-weight: bold;
	color: var(--panel-text);
}

input[type='text'],
select {
	border: 1px solid var(--panel-input-border);
	border-radius: 4px;
	padding: 6px 8px;
	background: var(--panel-input-bg);
	color: var(--panel-text);
	font-size: 13px;
	width: 100%;
	box-sizing: border-box;
}

input[readonly] {
	opacity: 0.7;
	cursor: default;
}

input[type='text']:focus,
select:focus {
	border-color: var(--panel-focus);
	box-shadow: 0 0 0 1px var(--panel-focus);
	outline: none;
}

.cbi-button {
	border: 1px solid var(--panel-border);
	border-radius: 4px;
	padding: 6px 10px;
	background: var(--panel-button-bg);
	color: var(--panel-text);
	font-size: 12px;
	font-weight: bold;
	cursor: pointer;
	box-shadow: 0 0 0 transparent;
}

.cbi-button:hover {
	background: var(--panel-button-hover);
	border-color: var(--panel-button-hover);
}

.cbi-button[disabled] {
	opacity: 0.6;
	cursor: default;
	pointer-events: none;
}

.cbi-button-add {
	border-color: var(--panel-success);
	background: var(--panel-success);
	color: var(--panel-secondary-bright);
}

.cbi-button-add:hover {
	background: var(--panel-action-hover);
	border-color: var(--panel-action-hover);
}

.cbi-button-remove {
	border-color: var(--panel-danger);
	background: var(--panel-danger);
	color: var(--panel-secondary-bright);
	width: 100%;
}

.cbi-button-remove:hover {
	background: var(--panel-danger-hover);
	border-color: var(--panel-danger-hover);
}

.cbi-button-save {
	border-color: var(--panel-success);
	background: var(--panel-success);
	color: var(--panel-secondary-bright);
}

.cbi-button-save.important {
	background: var(--panel-success);
	color: var(--panel-secondary-bright);
}

.cbi-button-save:hover {
	background: var(--panel-action-hover);
	border-color: var(--panel-action-hover);
}

.cbi-button:focus {
	outline: 2px solid var(--panel-focus);
	outline-offset: 2px;
}

.add-item {
	display: grid;
	grid-template-columns: 1fr 1fr auto;
	gap: 10px;
	align-items: end;
	padding-bottom: 6px;
	border-bottom: 1px dashed var(--panel-border);
}

.actions {
	display: flex;
	justify-content: flex-end;
	position: sticky;
	bottom: 0;
	z-index: 1;
	background: transparent;
	padding: 4px 0 4px;
	margin-top: 0;
	isolation: isolate;
}

.actions .cbi-button {
	z-index: 1;
	box-shadow: 0 5px 8px -7px var(--panel-shadow);
}

.actions::after {
	content: none;
}

.empty-state {
	font-size: 12px;
	color: var(--panel-muted);
	padding: 6px 2px;
}

@media (max-width: 520px) {
	.item-fields,
	.add-item {
		grid-template-columns: 1fr;
	}

	.actions {
		justify-content: stretch;
	}

	.actions .cbi-button {
		width: 100%;
	}
}
</style>
