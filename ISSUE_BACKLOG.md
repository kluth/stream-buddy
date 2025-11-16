# Stream Buddy Implementation Backlog

## Overview

This document provides a comprehensive overview of all 49 GitHub issues created for the Stream Buddy project. Issues are organized by implementation phase and follow S.M.A.R.T. criteria (Specific, Measurable, Achievable, Relevant, Time-bound).

**Total Issues**: 49  
**Estimated Total Time**: ~16 weeks (320 hours)  
**Source**: STREAMING_IMPLEMENTATION_PLAYBOOK.md

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2) - 8 Issues
**Goal**: Basic media capture and local preview

| Issue | Title | Priority | Time | Dependencies |
|-------|-------|----------|------|--------------|
| #1 | Create TypeScript type definitions | P0 | 2h | None |
| #2 | Implement MediaCaptureService | P0 | 4h | #1 |
| #3 | Create test utilities and mocks | P0 | 4h | #1 |
| #4 | Write unit tests for MediaCaptureService | P0 | 4h | #2, #3 |
| #5 | Create VideoPreviewComponent | P0 | 4h | #1, #2 |
| #6 | Set up HTTPS development environment | P0 | 2h | None |
| #7 | Create stream-setup feature module | P0 | 1d | #2, #5 |
| #8 | Create basic scene compositor service | P0 | 1d | #1, #2 |

**Phase 1 Total**: ~40 hours (5 days)

**Key Deliverables**:
- User can capture webcam feed
- User can see live preview
- HTTPS dev environment working
- All tests passing

---

### Phase 2: WebRTC Gateway (Weeks 3-4) - 6 Issues
**Goal**: Stream to media server via WebRTC

| Issue | Title | Priority | Time | Dependencies |
|-------|-------|----------|------|--------------|
| #9 | Deploy MediaMTX server with Docker | P0 | 4h | None |
| #10 | Implement WebRTCGatewayService | P0 | 1d | #1, #9 |
| #11 | Create WebRTC test utilities | P0 | 4h | #3 |
| #12 | Write WebRTCGatewayService tests | P0 | 4h | #10, #11 |
| #13 | Implement stream statistics service | P1 | 4h | #1, #10 |
| #14 | Create StreamStatsComponent | P1 | 4h | #13 |

**Phase 2 Total**: ~32 hours (4 days)

**Key Deliverables**:
- Browser sends WebRTC to MediaMTX
- MediaMTX converts to RTMP
- Stream stats displayed in real-time
- Connection state tracked reactively

---

### Phase 3: Platform Authentication (Weeks 5-6) - 8 Issues
**Goal**: OAuth integration for Twitch and YouTube

| Issue | Title | Priority | Time | Dependencies |
|-------|-------|----------|------|--------------|
| #15 | Create Node.js BFF backend | P1 | 4h | None |
| #16 | Implement security middleware | P1 | 1d | #15 |
| #17 | Implement CSRF interceptor | P1 | 4h | #16 |
| #18 | Create OAuth PKCE implementation | P1 | 1d | #15 |
| #19 | Implement Twitch OAuth | P1 | 1d | #15, #18 |
| #20 | Implement YouTube OAuth | P1 | 1d | #15, #18 |
| #21 | Create PlatformAuthService | P1 | 1d | #1, #19, #20 |
| #22 | Create platform-manager UI | P1 | 1d | #21 |

**Phase 3 Total**: ~88 hours (11 days)

**Key Deliverables**:
- Twitch OAuth working
- YouTube OAuth working
- Tokens stored securely (HttpOnly cookies)
- CSRF protection enabled

---

### Phase 4: Multi-Platform Streaming (Weeks 7-8) - 6 Issues
**Goal**: Simultaneous streaming to multiple platforms

| Issue | Title | Priority | Time | Dependencies |
|-------|-------|----------|------|--------------|
| #23 | Implement Twitch streaming API | P1 | 1d | #9, #19 |
| #24 | Implement YouTube streaming API | P1 | 1d | #9, #20 |
| #25 | Implement StreamOrchestrationService | P1 | 2d | #2, #8, #10, #23, #24 |
| #26 | Configure MediaMTX multi-output | P1 | 4h | #9 |
| #27 | Create live-dashboard UI | P1 | 1d | #5, #14, #25 |
| #28 | Integration tests | P1 | 1d | #2, #8, #10, #25 |

**Phase 4 Total**: ~88 hours (11 days)

**Key Deliverables**:
- Simultaneous streaming to Twitch + YouTube
- Platform-specific validation
- Stream health dashboard
- Errors on one platform don't affect others

---

### Phase 5: Scene Composition (Weeks 9-10) - 5 Issues
**Goal**: Advanced scene editor with overlays

| Issue | Title | Priority | Time | Dependencies |
|-------|-------|----------|------|--------------|
| #29 | Multi-source SceneCompositorService | P2 | 2d | #1, #8 |
| #30 | Text overlay support with XSS protection | P2 | 1d | #29 |
| #31 | Image overlay support | P2 | 1d | #29 |
| #32 | Scene-editor UI with drag-and-drop | P2 | 2d | #29, #30, #31 |
| #33 | Scene preset management | P2 | 4h | #1, #29 |

**Phase 5 Total**: ~80 hours (10 days)

**Key Deliverables**:
- Multi-source scene composition
- Text/image overlays
- Drag-and-drop positioning
- Scene templates

---

### Phase 6: Audio Mixing (Weeks 11-12) - 5 Issues
**Goal**: Web Audio API integration for audio mixing

| Issue | Title | Priority | Time | Dependencies |
|-------|-------|----------|------|--------------|
| #34 | Implement AudioMixerService | P2 | 1d | #1, #2 |
| #35 | Implement audio metering | P2 | 4h | #34 |
| #36 | Create AudioMeterComponent | P2 | 4h | #35 |
| #37 | Audio processing filters | P2 | 4h | #1, #2 |
| #38 | Audio/video sync testing | P2 | 4h | #13, #34 |

**Phase 6 Total**: ~32 hours (4 days)

**Key Deliverables**:
- Multi-source audio mixing
- Volume controls per source
- Visual audio meters
- Audio stays in sync with video (< 50ms)

---

### Phase 7: Instagram & Refinements (Weeks 13-14) - 5 Issues
**Goal**: Instagram support and platform polish

| Issue | Title | Priority | Time | Dependencies |
|-------|-------|----------|------|--------------|
| #39 | Implement Instagram RTMP streaming | P2 | 1d | #9, #29 |
| #40 | Vertical format support (9:16) | P2 | 1d | #29 |
| #41 | Platform-specific validators | P2 | 4h | #1 |
| #42 | Stream configuration UI | P2 | 1d | #41 |
| #43 | TikTok documentation | P2 | 1h | None |

**Phase 7 Total**: ~36 hours (4.5 days)

**Key Deliverables**:
- Instagram streaming working
- Vertical format support
- Platform compliance checks
- TikTok limitations documented

---

### Phase 8: Production Hardening (Weeks 15-16) - 6 Issues
**Goal**: Security, performance, monitoring

| Issue | Title | Priority | Time | Dependencies |
|-------|-------|----------|------|--------------|
| #44 | Sentry error tracking | P3 | 4h | None |
| #45 | Performance monitoring | P3 | 1d | #44 |
| #46 | OWASP security audit | P3 | 2d | Phase 3 complete |
| #47 | Bundle size optimization | P3 | 1d | All features |
| #48 | MediaMTX load testing | P3 | 1d | #9, #26 |
| #49 | Deployment documentation | P3 | 2d | All phases |

**Phase 8 Total**: ~96 hours (12 days)

**Key Deliverables**:
- Production-ready security
- Error tracking integrated
- Performance metrics collected
- Deployment documentation complete

---

## Issue Statistics by Category

### By Priority
- **P0 (Critical Path)**: 14 issues (~112 hours)
- **P1 (Core Features)**: 14 issues (~152 hours)
- **P2 (Advanced Features)**: 15 issues (~148 hours)
- **P3 (Polish)**: 6 issues (~96 hours)

### By Type
- **Service**: 13 issues
- **UI**: 8 issues
- **Backend**: 8 issues
- **Testing**: 7 issues
- **Infrastructure**: 6 issues
- **Security**: 5 issues
- **Documentation**: 2 issues

### By Time Estimate
- **1-2 hours**: 2 issues
- **4 hours**: 20 issues
- **1 day (8 hours)**: 21 issues
- **2 days (16 hours)**: 6 issues

---

## Critical Path (P0 Issues)

The critical path represents the minimum viable product (MVP):

1. #1: TypeScript types (2h)
2. #2: MediaCaptureService (4h)
3. #3: Test utilities (4h)
4. #4: MediaCaptureService tests (4h)
5. #5: VideoPreviewComponent (4h)
6. #6: HTTPS setup (2h)
7. #7: Stream-setup UI (1d)
8. #8: Basic scene compositor (1d)
9. #9: MediaMTX deployment (4h)
10. #10: WebRTCGatewayService (1d)
11. #11: WebRTC test utilities (4h)
12. #12: WebRTCGatewayService tests (4h)

**Critical Path Total**: ~112 hours (14 days)

At the end of the critical path, users can:
- Capture camera/microphone
- See live preview
- Connect to MediaMTX via WebRTC
- Output to RTMP

---

## Dependency Graph

### Key Dependencies
- **All services depend on**: #1 (TypeScript types)
- **All WebRTC features depend on**: #9 (MediaMTX), #10 (WebRTCGatewayService)
- **All platform streaming depends on**: Phase 3 (Authentication) complete
- **Multi-platform streaming depends on**: #25 (StreamOrchestrationService)
- **Advanced scenes depend on**: #29 (Multi-source compositor)
- **Production deployment depends on**: All previous phases

### Parallel Work Opportunities
The following can be developed in parallel:
- **Phase 1**: UI components (#5, #7) can be built while services (#2, #8) are being tested
- **Phase 2**: Stats service (#13, #14) can be built after #10 completes
- **Phase 3**: Backend (#15-#20) and frontend (#21-#22) can progress in parallel
- **Phase 5**: Text overlays (#30), image overlays (#31), and scene presets (#33) are independent

---

## S.M.A.R.T. Compliance

All 49 issues meet S.M.A.R.T. criteria:

### Specific
- Every issue has a clear, action-oriented title
- User stories define WHO, WHAT, WHY
- Technical notes provide implementation guidance

### Measurable
- All issues have testable acceptance criteria (checkboxes)
- Success is verifiable (tests pass, feature works)
- Includes UI, functionality, and edge case criteria

### Achievable
- Issues range from 1 hour to 2 days (maximum)
- Single developer can complete each issue
- Complex features are broken into multiple issues

### Relevant
- All issues directly support high-level playbook goals
- Context section links to playbook
- Technical notes reference playbook sections

### Time-bound
- Every issue has a time estimate label
- Total project timeline: 16 weeks
- Critical path: 14 days

---

## Getting Started

### For Developers
1. Start with the critical path (P0 issues #1-#12)
2. Follow the dependency graph
3. Complete all acceptance criteria before closing
4. Ensure tests pass and coverage > 80%

### For Project Managers
1. Assign issues based on dependencies
2. Monitor critical path progress
3. P0 issues are blocking for subsequent phases
4. Use time estimates for sprint planning

### For QA
1. Verify all acceptance criteria are met
2. Test edge cases and error handling
3. Validate Angular standards (CLAUDE.md)
4. Check OWASP security requirements (#46)

---

## Resources

- **Playbook**: `/home/matthias/projects/stream-buddy/STREAMING_IMPLEMENTATION_PLAYBOOK.md`
- **Angular Standards**: `/home/matthias/projects/stream-buddy/.claude/CLAUDE.md`
- **GitHub Repository**: https://github.com/kluth/stream-buddy
- **Issues**: https://github.com/kluth/stream-buddy/issues

---

## Notes

- All issues follow Angular standalone component architecture
- Security is embedded from Phase 1 (not bolted on later)
- Testing is parallel to implementation (TDD approach)
- No shortcuts on security (OWASP compliance required)
- Issues reference playbook line numbers for traceability

**Last Updated**: 2025-11-14
**Created By**: Claude (Product Owner AI)
**Total Issues**: 49
**Status**: Ready for implementation
