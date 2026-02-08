# open-urls-in-container
> This project is a fork of this repository: [open-urls-in-container](https://gitlab.com/hughblackall/open-urls-in-container)

Firefox's Multi-Account Containers extension provides functionality to open certain websites in specific containers out of the box, but only allows for matching URLs based on a domain. This extension allows for regex matching against the whole URL as opposed to exact matches based on domain.

## Installation

- Fork (this repo): [addons.mozilla.org](https://addons.mozilla.org/firefox/addon/open-urls-in-container-fork)

- Original: [addons.mozilla.org](https://addons.mozilla.org/firefox/addon/open-urls-in-container/)

### Building

- To build and package the extension for distribution, run:
    ```bash
    yarn install
    yarn build
    ```
    - This will run the webpack build and place the output in `build/webpack`, after which the extension will be packaged using `web-ext` and the output will be placed in `web-ext-artifacts`.
