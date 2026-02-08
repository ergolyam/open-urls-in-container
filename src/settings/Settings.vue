<template>
	<div class="panel">
		<div v-if="view === 'containers'" class="menu-panel container-picker-panel">
			<h3 class="title">Manage Containers</h3>
			<hr>
			<div class="scrollable identities-list">
				<table class="menu" id="picker-identities-list">
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
							<span class="menu-text">{{ container.name }}</span>
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
			<h3 class="title" id="edit-assignments-title">{{ selectedContainerName }}</h3>
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
				<table class="menu" id="edit-sites-assigned" :hidden="selectedUrls.length === 0">
					<tr v-for="url in selectedUrls" :key="url.id" class="menu-item hover-highlight">
						<td>
							<div class="favicon">
								<span class="favicon-dot"></span>
							</div>
							<span class="menu-text truncate-text" :title="url.pattern">{{ url.pattern }}</span>
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

<style lang="scss" scoped>
@font-face {
	font-family: 'Metropolis';
	font-style: normal;
	font-weight: 800;
	src: url('../extension/fonts/Metropolis-Medium.woff2') format('woff2');
}

@font-face {
	font-family: 'Inter';
	font-style: normal;
	font-weight: 400;
	src: url('../extension/fonts/Inter-Regular.woff2') format('woff2');
}

:global(:root) {
	--font-inter: 'Inter', sans-serif;
	--font-metropolis: 'Metropolis', sans-serif;
	--icon-arrow-left: url('../extension/img/arrow-icon-left.svg');
	--text-color-primary: #15141a;
	--button-bg-color-primary: #0060df;
	--button-bg-hover-color-primary: #0250bb;
	--button-bg-active-color-primary: #054096;
	--button-bg-focus-color-primary: #0060df;
	--button-text-color-primary: #fbfbfe;
	--button-bg-color-secondary: #f0f0f4;
	--button-bg-hover-color-secondary: #e0e0e6;
	--button-bg-active-color-secondary: #cfcfd8;
	--button-destructive-bg-color: #e22850;
	--button-destructive-bg-hover-color: #c50042;
	--button-destructive-bg-active-color: #810220;
	--button-destructive-bg-focus-color: #e22850;
	--button-destructive-text-color: #fbfbfe;
	--input-bg-color: #fff;
	--input-border-color: #8f8f9d;
	--input-border-focus-color: #0060df;
	--menu-bg-hover-color: #e0e0e6;
	--menu-bg-active-color: #cfcfd8;
	--panel-bg-color: #fff;
	--panel-separator-color: rgba(240, 240, 244, 1);
}

:global(*) {
	box-sizing: border-box;
}

:global(html) {
	background: var(--panel-bg-color);
	font-size: 12px;
	block-size: 100%;
	max-block-size: 650px;
	min-block-size: 300px;
}

:global(body) {
	margin: 0;
	background: var(--panel-bg-color);
	color: var(--text-color-primary);
	font-family: var(--font-inter);
	font-size: 13px;
	inline-size: 352px;
	min-inline-size: 352px;
	max-inline-size: 352px;
	block-size: 100%;
	max-block-size: 650px;
	min-block-size: 300px;
}

:global(#app) {
	block-size: 100%;
}

@media (prefers-color-scheme: dark) {
	:global(:root) {
		--icon-arrow-left: url('../extension/img/arrow-icon-left-light.svg');
		--text-color-primary: #fbfbfe;
		--button-bg-color-primary: #0df;
		--button-bg-hover-color-primary: #80ebff;
		--button-bg-active-color-primary: #aaf2ff;
		--button-bg-focus-color-primary: #0df;
		--button-text-color-primary: #15141a;
		--button-bg-color-secondary: #2b2a33;
		--button-bg-hover-color-secondary: #52525e;
		--button-bg-active-color-secondary: #5b5b66;
		--button-destructive-bg-color: #ff8480;
		--button-destructive-bg-hover-color: #ffbdc5;
		--button-destructive-bg-active-color: #ffdfe7;
		--button-destructive-bg-focus-color: #ff8480;
		--button-destructive-text-color: #15141a;
		--input-bg-color: #2b2a33;
		--input-border-color: #8f8f9d;
		--input-border-focus-color: #0df;
		--menu-bg-hover-color: #52525e;
		--menu-bg-active-color: #5b5b66;
		--panel-bg-color: #42414d;
		--panel-separator-color: rgba(82, 82, 94, 1);
	}

	:global(.menu-arrow img) {
		filter: invert(0);
	}

}

.panel {
	background: var(--panel-bg-color);
	color: var(--text-color-primary);
	inline-size: 100%;
	block-size: 100%;
}

.menu-panel {
	position: relative;
	display: flex;
	flex-direction: column;
	block-size: 100%;
}

h3.title {
	block-size: 48px;
	color: var(--text-color-primary);
	font-family: var(--font-metropolis);
	font-size: 14px;
	font-weight: 700;
	inline-size: 100%;
	line-height: 48px;
	text-align: center;
}

hr {
	border: 0;
	border-block-start: 1px solid var(--panel-separator-color);
}

.scrollable {
	flex: 1;
	overflow-y: auto;
	overflow-x: hidden;
	padding-block-end: 8px;
}

.menu {
	border: 0;
	border-spacing: 0;
	inline-size: 100%;
	padding: 8px;
}

.menu-item {
	align-items: center;
	block-size: 32px;
	border-radius: 4px;
	cursor: pointer;
	display: flex;
	inline-size: 100%;
}

.menu-item td {
	align-items: center;
	display: flex;
	inline-size: 100%;
	padding-inline: 8px;
	gap: 0;
}

.hover-highlight {
	transition: background-color 0.1s ease-in-out, color 0.1s ease-in-out;
}

.hover-highlight:hover {
	background-color: var(--menu-bg-hover-color);
}

.hover-highlight:active {
	background-color: var(--menu-bg-active-color);
}

.hover-highlight:focus {
	outline: 2px solid var(--button-bg-focus-color-primary);
	outline-offset: 2px;
}

.menu-icon {
	display: block;
	block-size: 16px;
	inline-size: 23px;
	margin-inline-end: 8px;
	text-align: center;
}

.menu-text {
	color: var(--text-color-primary);
	display: block;
	flex: 1;
	min-inline-size: 0;
}

.menu-right-float {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	margin-inline-start: auto;
	padding-inline-start: 16px;
	gap: 4px;
}

.container-count {
	opacity: 0.7;
	min-inline-size: 24px;
	text-align: center;
}

.menu-arrow {
	display: flex;
	align-items: center;
}

.menu-arrow img {
	block-size: 24px;
	inline-size: 12px;
	opacity: 0.9;
}

.usercontext-icon {
	background-image: var(--identity-icon);
	background-position: center center;
	background-repeat: no-repeat;
	background-size: 16px;
	block-size: 100%;
	fill: var(--identity-icon-color);
	filter: url('../extension/img/filters.svg#fill');
}

[data-identity-color='blue'] {
	--identity-icon-color: #37adff;
}

[data-identity-color='turquoise'] {
	--identity-icon-color: #00c79a;
}

[data-identity-color='green'] {
	--identity-icon-color: #51cd00;
}

[data-identity-color='grey'] {
	--identity-icon-color: #616161;
}

[data-identity-color='yellow'] {
	--identity-icon-color: #ffcb00;
}

[data-identity-color='orange'] {
	--identity-icon-color: #ff9f00;
}

[data-identity-color='red'] {
	--identity-icon-color: #ff613d;
}

[data-identity-color='pink'] {
	--identity-icon-color: #ff4bda;
}

[data-identity-color='purple'] {
	--identity-icon-color: #af51f5;
}

[data-identity-icon='fingerprint'] {
	--identity-icon: url('../extension/img/usercontext.svg#fingerprint');
}

[data-identity-icon='briefcase'] {
	--identity-icon: url('../extension/img/usercontext.svg#briefcase');
}

[data-identity-icon='dollar'] {
	--identity-icon: url('../extension/img/usercontext.svg#dollar');
}

[data-identity-icon='cart'] {
	--identity-icon: url('../extension/img/usercontext.svg#cart');
}

[data-identity-icon='circle'] {
	--identity-icon: url('../extension/img/usercontext.svg#circle');
}

[data-identity-icon='food'] {
	--identity-icon: url('../extension/img/usercontext.svg#food');
}

[data-identity-icon='gift'] {
	--identity-icon: url('../extension/img/usercontext.svg#gift');
}

[data-identity-icon='vacation'] {
	--identity-icon: url('../extension/img/usercontext.svg#vacation');
}

[data-identity-icon='fruit'] {
	--identity-icon: url('../extension/img/usercontext.svg#fruit');
}

[data-identity-icon='pet'] {
	--identity-icon: url('../extension/img/usercontext.svg#pet');
}

[data-identity-icon='tree'] {
	--identity-icon: url('../extension/img/usercontext.svg#tree');
}

[data-identity-icon='chill'] {
	--identity-icon: url('../extension/img/usercontext.svg#chill');
}

[data-identity-icon='fence'] {
	--identity-icon: url('../extension/img/usercontext.svg#fence');
}

.btn-return.arrow-left {
	background-image: var(--icon-arrow-left);
	background-repeat: no-repeat;
	background-position: center center;
	background-color: var(--button-bg-color-secondary);
	border: 0;
	border-radius: 4px;
	block-size: 32px;
	inline-size: 32px;
	cursor: pointer;
	inset-block-start: 8px;
	inset-inline-start: 8px;
	position: absolute;
	z-index: 2;
}

.btn-return.arrow-left:hover {
	background-color: var(--button-bg-hover-color-secondary);
}

.btn-return.arrow-left:focus {
	outline: 2px solid var(--button-bg-focus-color-primary);
	outline-offset: 2px;
}

.assignment-input-wrap {
	padding: 8px 16px 0;
}

.hide-label {
	position: absolute;
	block-size: 1px;
	inline-size: 1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
}

.assignment-input-row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: 8px;
	align-items: center;
}

input[type='text'] {
	block-size: 32px;
	border: 1px solid var(--input-border-color);
	border-radius: 4px;
	background: var(--input-bg-color);
	color: var(--text-color-primary);
	padding: 0 8px;
	font: inherit;
}

input[type='text']:focus {
	border-color: var(--input-border-focus-color);
	outline: 1px solid var(--input-border-focus-color);
}

.button {
	block-size: 32px;
	padding: 0 12px;
	border: 0;
	border-radius: 4px;
	font-family: var(--font-metropolis);
	font-size: 13px;
	cursor: pointer;
}

.button.primary {
	background: var(--button-bg-color-primary);
	color: var(--button-text-color-primary);
}

.button.primary:hover {
	background: var(--button-bg-hover-color-primary);
}

.button.primary:active {
	background: var(--button-bg-active-color-primary);
}

.button.primary:disabled {
	opacity: 0.5;
	cursor: default;
}

.edit-sites-assigned {
	padding-top: 8px;
}

.sub-header {
	color: var(--text-color-primary);
	block-size: 24px;
	line-height: 24px;
	padding-inline: 16px;
	font-family: var(--font-inter);
	font-weight: 600;
}

.favicon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	inline-size: 16px;
	block-size: 16px;
	margin-inline-end: 8px;
}

.favicon-dot {
	inline-size: 10px;
	block-size: 10px;
	border-radius: 999px;
	background: var(--input-border-color);
	opacity: 0.8;
}

.truncate-text {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.trash-button {
	display: none;
	inline-size: 20px;
	block-size: 20px;
	margin-inline-start: 8px;
}

.menu-item:hover .trash-button,
.menu-item:focus-within .trash-button {
	display: inline-block;
}

.delete-assignment {
	cursor: pointer;
	filter: invert(1);
}

@media (prefers-color-scheme: dark) {
	.delete-assignment {
		filter: none;
	}
}

.empty-state {
	color: var(--text-color-primary);
	opacity: 0.65;
	padding: 8px 16px;
}

@media (max-width: 360px) {
	:global(body) {
		inline-size: 100%;
		min-inline-size: 320px;
	}
}
</style>
