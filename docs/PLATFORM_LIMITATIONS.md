# Platform Limitations and Guidance

This document outlines known limitations and specific guidance for streaming to various platforms using Broadboi.

## TikTok Live Streaming

**Current Status (as of 2025-11-30): No Official Live Streaming API**

As of the current date, TikTok does **not** provide an official public API for third-party applications like Broadboi to integrate directly with its live streaming features. This means you cannot directly stream to TikTok Live using Broadboi's platform integration.

### Known Limitations and Requirements:

*   **No Public API:** TikTok has not released a public API that allows developers to programmatically start, stop, or manage live streams.
*   **Follower Requirements:** Typically, TikTok Live requires creators to have a minimum number of followers (e.g., 1,000 followers in many regions) to even access the live streaming feature from within the TikTok app itself.
*   **TikTok Live Studio:** TikTok offers its own desktop application, "TikTok Live Studio," for Windows users. This application allows direct streaming from a PC, but it is a standalone tool and does not offer an API for external software integration.
*   **Unofficial APIs / Reverse Engineering:** We strongly advise against using any unofficial, reverse-engineered APIs or workarounds to stream to TikTok. Such methods often violate TikTok's Terms of Service (TOS) and Community Guidelines, which could lead to temporary suspensions or permanent bans of your TikTok account. Broadboi will not support integrations that violate platform policies.

### Guidance and Alternatives:

*   **Use TikTok Live Studio:** If you meet TikTok's eligibility criteria, consider using their official "TikTok Live Studio" application directly from your desktop for PC-based streaming.
*   **Monitor for API Announcements:** We continuously monitor the [TikTok for Developers](https://developers.tiktok.com/) platform for any announcements regarding new live streaming APIs. Should a stable and official API become available, Broadboi will evaluate its integration.
*   **Focus on Supported Platforms:** For multi-platform streaming, focus on platforms officially supported by Broadboi, such as Twitch, YouTube, and Instagram (where direct RTMP URL/Stream Key input is available).

### Why Broadboi Cannot Support TikTok Live Directly:

Broadboi prioritizes secure, reliable, and compliant integrations. Without an official API from TikTok, we cannot guarantee the stability, legality, or safety of any integration. We aim to protect our users from potential TOS violations and account penalties.

---
**Last Updated**: 2025-11-30
**Maintained By**: Broadboi Development Team
