<template>
	<div class="panel">
		<header class="panel-header">
			<div class="panel-title">Container URL Rules</div>
			<div class="panel-subtitle">Match URL patterns to containers.</div>
		</header>

		<section class="cbi-section">
			<div class="cbi-section-title">
				<span>Rules</span>
			</div>

			<div class="cbi-dynlist" data-dynlist>
				<div v-if="urls.length === 0" class="empty-state">No rules yet.</div>

				<div class="item" v-for="(url, index) in urls" :key="url.id">
					<div class="item-fields">
						<label class="field">
							<span class="field-label">Domain pattern</span>
							<input
								type="text"
								v-model="url.pattern"
								placeholder="*.example.com/*"
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
					<button class="cbi-button cbi-button-remove" type="button" @click="removeUrl(index)">
						Delete
					</button>
				</div>

				<div class="add-item">
					<label class="field">
						<span class="field-label">Domain pattern</span>
						<input
							type="text"
							v-model="newPattern"
							placeholder="*.example.com/*"
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
			preferences: {},
			newPattern: '',
			newContainerName: '',
		}
	},
	computed: {
		canAdd() {
			return this.newPattern.trim().length > 0 && this.newContainerName.length > 0
		},
	},
	async mounted() {
		console.debug('Load storage:', await browser.storage.sync.get({ urls: [] }))
		const { urls, preferences } = await browser.storage.sync.get({ urls: [], preferences: {} })
		this.urls = urls
		this.preferences = preferences
		browser.storage.sync.onChanged.addListener(this.syncStorage)
		this.contextualIdentities = await browser.contextualIdentities.query({})
		if (!this.newContainerName && this.contextualIdentities.length > 0) {
			this.newContainerName = this.contextualIdentities[0].name
		}
	},
	unmounted() {
		browser.storage.sync.onChanged.removeListener(this.syncStorage)
	},
	methods: {
		addUrl() {
			if (!this.canAdd) {
				return
			}
			this.urls.push({
				id: uuid(),
				pattern: this.newPattern.trim(),
				// Use name as assumed unique container identifier, as this is how the Multi-Account
				// Containers extension handles uniqueness when syncing
				// See https://github.com/mozilla/multi-account-containers/blob/e5fa98d69e317b52b7ab107545f8ffdeb7b753a5/src/js/background/sync.js#L329
				containerName: this.newContainerName,
			})
			this.newPattern = ''
		},
		removeUrl(index) {
			this.urls.splice(index, 1)
		},
		async save() {
			console.debug('Save URLs:', toRaw(this.urls))
			console.debug('Save Preferences:', toRaw(this.preferences))
			// TODO: If any URL patterns are empty, remove them
			await browser.storage.sync.set({
				urls: toRaw(this.urls),
				preferences: toRaw(this.preferences),
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
			if (changes.preferences) {
				this.preferences = changes.preferences.newValue
			}
		},
	},
}
</script>

<style lang="scss" scoped>
:global(:root) {
	--panel-main-bright: #00b5e2;
	--panel-main-dark: #002b49;
	--panel-secondary-bright: #ffffff;
	--panel-secondary-dark: #212322;
	--panel-danger: #cc1111;
	--panel-success: #5cb85c;
	--panel-action: #37c;
	--panel-border: #aaa;
	--panel-border-strong: #000;
	--panel-text: #212322;
	--panel-muted: #444;
	--panel-bg: #ffffff;
	--panel-panel-bg: #f7f7f7;
	--panel-item-bg: #eeeeec;
	--panel-input-bg: #ffffff;
	--panel-input-border: #000;
	--panel-shadow: rgba(0, 0, 0, 0.15);
}

:global(body) {
	margin: 0;
	background: var(--panel-bg);
	color: var(--panel-text);
	font-family: "Helvetica", "Arial", sans-serif;
	min-width: 360px;
}

@media (prefers-color-scheme: dark) {
	:global(:root) {
		--panel-text: var(--panel-secondary-bright);
		--panel-muted: #cdd5db;
		--panel-bg: var(--panel-main-dark);
		--panel-panel-bg: var(--panel-secondary-dark);
		--panel-item-bg: var(--panel-secondary-dark);
		--panel-input-bg: var(--panel-main-dark);
		--panel-input-border: var(--panel-main-bright);
		--panel-shadow: rgba(0, 0, 0, 0.4);
	}
}

.panel {
	padding: 14px;
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding-bottom: 10px;
}

.panel-header {
	background: linear-gradient(90deg, var(--panel-main-bright), #67c8ea);
	color: var(--panel-secondary-bright);
	padding: 12px 14px;
	border-radius: 4px;
	box-shadow: inset 0 0 1px var(--panel-main-dark);
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
	border: 1px solid var(--panel-border);
	border-radius: 4px;
	box-shadow: 0 1px 2px var(--panel-shadow);
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
	border: 1px outset var(--panel-input-border);
	border-radius: 3px;
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

.cbi-button {
	border: 1px solid var(--panel-border);
	border-radius: 3px;
	padding: 6px 10px;
	background: var(--panel-secondary-bright);
	color: var(--panel-text);
	font-size: 12px;
	font-weight: bold;
	cursor: pointer;
	box-shadow: 0 0 0 transparent;
}

.cbi-button:hover {
	box-shadow: 0 0 3px var(--panel-action);
}

.cbi-button[disabled] {
	opacity: 0.6;
	cursor: default;
	pointer-events: none;
}

.cbi-button-add {
	border-color: var(--panel-success);
	color: var(--panel-success);
}

.cbi-button-remove {
	border-color: var(--panel-danger);
	color: var(--panel-danger);
	width: 100%;
}

.cbi-button-save {
	border-color: var(--panel-success);
	color: var(--panel-success);
}

.cbi-button-save.important {
	background: var(--panel-success);
	color: var(--panel-secondary-bright);
}

.add-item {
	display: grid;
	grid-template-columns: 1fr 1fr auto;
	gap: 10px;
	align-items: end;
	padding-top: 6px;
	border-top: 1px dashed var(--panel-border);
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
	content: '';
	position: absolute;
	left: -14px;
	right: -14px;
	bottom: 0;
	height: 12px;
	background: linear-gradient(0deg, var(--panel-bg), transparent);
	pointer-events: none;
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
