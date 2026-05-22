# Privacy Policy — Shadow Scholar

**Last updated:** May 22, 2026

## Overview

Shadow Scholar ("the Extension") is an AI-powered study and reading assistant browser extension. We are committed to protecting your privacy. This privacy policy explains what data the Extension accesses, how it is used, and your choices.

## Data Collection

**Shadow Scholar does not collect, store, or transmit any personal data to us or any third party.**

All data processed by the Extension stays on your local device unless you explicitly choose to send it to your own configured AI API endpoint.

## Data Accessed

### Website Content
When you explicitly trigger an analysis (by clicking the floating button, using the context menu, or pressing "Analyze Page"), the Extension reads text content from the current webpage. This content is:
- Sent **only** to the AI API endpoint that **you** configure in the Extension settings
- **Never** sent to us or any other third party
- **Not** stored permanently — conversation data is kept in browser memory during the session and in local storage for history

### User Configuration
The Extension stores the following settings locally on your device using `chrome.storage.local`:
- API endpoint URL
- API Key (stored locally, never transmitted except to your configured endpoint)
- AI model name
- System prompt customization
- Feature toggle preferences

This data **never leaves your browser** except when making API requests to your own configured endpoint.

## Data NOT Collected

Shadow Scholar does **not** collect:
- Personal identification information
- Browsing history or web activity
- Cookies or tracking data
- Location data
- Financial information
- Analytics or telemetry data
- Keystroke or mouse activity logs

## Third-Party Services

The Extension connects to external AI API endpoints (e.g., OpenAI, DeepSeek, OpenRouter) **only as configured by you**. The Extension itself does not operate any server or backend service. Please review the privacy policy of your chosen AI API provider.

## Local Privacy and Page Interaction Controls

The Extension includes optional local controls intended to improve page interaction and user privacy while using the assistant. These controls may help preserve normal browser interactions such as text selection, clipboard actions, and context menu access on supported pages. This feature:
- Runs entirely on your local device
- Does not collect or transmit any data
- Can be toggled on/off at any time from the Extension settings
- Applies only in the browser and does not create any developer-operated data collection

## Permissions

The Extension requests the following browser permissions:
- **activeTab / scripting**: To read page content when you request analysis
- **storage**: To save your local settings and preferences
- **sidePanel**: To display the chat interface
- **contextMenus**: To provide right-click analysis option
- **offscreen**: To maintain API connection during streaming responses
- **Host permissions**: To access page content on any site and connect to your configured API endpoint

## Children's Privacy

The Extension is not directed at children under 13 and does not knowingly collect data from children.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last updated" date above.

## Contact

If you have questions about this privacy policy, please open an issue on our [GitHub repository](https://github.com/MeiTetsuH/shadow-scholar).
