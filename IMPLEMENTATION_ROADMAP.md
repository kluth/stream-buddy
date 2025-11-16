# Stream Buddy Implementation Roadmap

## Quick Reference: 8 Phases, 49 Issues, 16 Weeks

```
PHASE 1: Foundation (Weeks 1-2)
├── #1  TypeScript Types (2h) ──────────────┐
├── #2  MediaCaptureService (4h) ───────────┤
├── #3  Test Utilities (4h) ────────────────┤
├── #4  MediaCapture Tests (4h) ────────────┼─ Critical Path
├── #5  VideoPreviewComponent (4h) ─────────┤
├── #6  HTTPS Setup (2h) ───────────────────┤
├── #7  Stream-Setup UI (1d) ───────────────┤
└── #8  Scene Compositor (1d) ──────────────┘

PHASE 2: WebRTC Gateway (Weeks 3-4)
├── #9  MediaMTX Deployment (4h) ───────────┐
├── #10 WebRTCGatewayService (1d) ──────────┤
├── #11 WebRTC Test Utils (4h) ─────────────┼─ Critical Path
├── #12 WebRTC Tests (4h) ──────────────────┘
├── #13 StreamStatsService (4h) ────────────┐
└── #14 StreamStatsComponent (4h) ──────────┘─ Core Features

PHASE 3: Authentication (Weeks 5-6)
├── #15 Node.js BFF Backend (4h) ───────────┐
├── #16 Security Middleware (1d) ───────────┤
├── #17 CSRF Interceptor (4h) ──────────────┤
├── #18 OAuth PKCE (1d) ────────────────────┼─ Core Features
├── #19 Twitch OAuth (1d) ──────────────────┤
├── #20 YouTube OAuth (1d) ─────────────────┤
├── #21 PlatformAuthService (1d) ───────────┤
└── #22 Platform Manager UI (1d) ───────────┘

PHASE 4: Multi-Platform (Weeks 7-8)
├── #23 Twitch Streaming API (1d) ──────────┐
├── #24 YouTube Streaming API (1d) ─────────┤
├── #25 StreamOrchestration (2d) ───────────┼─ Core Features
├── #26 Multi-Output MediaMTX (4h) ─────────┤
├── #27 Live Dashboard UI (1d) ─────────────┤
└── #28 Integration Tests (1d) ─────────────┘

PHASE 5: Scene Composition (Weeks 9-10)
├── #29 Multi-Source Compositor (2d) ───────┐
├── #30 Text Overlays + XSS (1d) ───────────┤
├── #31 Image Overlays (1d) ────────────────┼─ Advanced
├── #32 Scene Editor UI (2d) ───────────────┤
└── #33 Scene Presets (4h) ─────────────────┘

PHASE 6: Audio Mixing (Weeks 11-12)
├── #34 AudioMixerService (1d) ─────────────┐
├── #35 Audio Metering (4h) ────────────────┤
├── #36 AudioMeterComponent (4h) ───────────┼─ Advanced
├── #37 Audio Processing (4h) ──────────────┤
└── #38 A/V Sync Testing (4h) ──────────────┘

PHASE 7: Refinements (Weeks 13-14)
├── #39 Instagram Streaming (1d) ───────────┐
├── #40 Vertical Format (1d) ───────────────┤
├── #41 Platform Validators (4h) ───────────┼─ Advanced
├── #42 Stream Config UI (1d) ──────────────┤
└── #43 TikTok Docs (1h) ───────────────────┘

PHASE 8: Production (Weeks 15-16)
├── #44 Sentry Integration (4h) ────────────┐
├── #45 Performance Monitoring (1d) ────────┤
├── #46 OWASP Audit (2d) ───────────────────┼─ Polish
├── #47 Bundle Optimization (1d) ───────────┤
├── #48 Load Testing (1d) ──────────────────┤
└── #49 Deployment Docs (2d) ───────────────┘
```

## Dependency Flow

```
#1 TypeScript Types
  ├── #2 MediaCaptureService
  │   ├── #3 Test Utilities
  │   │   └── #4 MediaCapture Tests
  │   ├── #5 VideoPreviewComponent
  │   │   └── #7 Stream-Setup UI
  │   ├── #8 Scene Compositor
  │   │   └── #29 Multi-Source Compositor
  │   │       ├── #30 Text Overlays
  │   │       ├── #31 Image Overlays
  │   │       ├── #32 Scene Editor
  │   │       ├── #33 Scene Presets
  │   │       └── #40 Vertical Format
  │   ├── #34 AudioMixer
  │   │   ├── #35 Audio Metering
  │   │   ├── #36 AudioMeter Component
  │   │   ├── #37 Audio Processing
  │   │   └── #38 A/V Sync
  │   └── #41 Validators
  │       └── #42 Stream Config UI
  ├── #9 MediaMTX
  │   ├── #10 WebRTC Gateway
  │   │   ├── #11 WebRTC Test Utils
  │   │   │   └── #12 WebRTC Tests
  │   │   ├── #13 Stream Stats
  │   │   │   └── #14 Stats Component
  │   │   └── #25 Orchestration
  │   │       ├── #27 Live Dashboard
  │   │       └── #28 Integration Tests
  │   ├── #23 Twitch Streaming
  │   ├── #24 YouTube Streaming
  │   ├── #26 Multi-Output Config
  │   ├── #39 Instagram Streaming
  │   └── #48 Load Testing
  └── #15 BFF Backend
      ├── #16 Security Middleware
      │   └── #17 CSRF Interceptor
      ├── #18 OAuth PKCE
      │   ├── #19 Twitch OAuth
      │   │   └── #23 Twitch Streaming
      │   ├── #20 YouTube OAuth
      │   │   └── #24 YouTube Streaming
      │   └── #21 PlatformAuth Service
      │       └── #22 Platform Manager UI
      └── #46 OWASP Audit

Standalone Issues:
├── #6 HTTPS Setup
├── #43 TikTok Docs
├── #44 Sentry Integration
│   └── #45 Performance Monitoring
├── #47 Bundle Optimization
└── #49 Deployment Docs
```

## MVP (Minimum Viable Product)

**Goal**: Basic single-platform streaming  
**Time**: 4-6 weeks  
**Issues**: #1-#12, #15-#24, #25-#27

**User Can**:
1. Capture camera and microphone
2. See live preview
3. Authenticate with Twitch or YouTube
4. Start/stop streaming
5. Monitor stream health

**MVP Excludes**:
- Scene composition (single source only)
- Audio mixing (system audio capture works, but no mixing)
- Multiple simultaneous platforms
- Advanced overlays

---

## Sprint Planning Guide

### Sprint 1-2: Foundation (Weeks 1-2)
**Focus**: Media capture + preview  
**Issues**: #1-#8  
**Team Size**: 2-3 developers  
**Deliverable**: Working camera capture with preview

### Sprint 3-4: WebRTC (Weeks 3-4)
**Focus**: Connect to MediaMTX  
**Issues**: #9-#14  
**Team Size**: 2-3 developers  
**Deliverable**: Browser → MediaMTX → RTMP working

### Sprint 5-6: Authentication (Weeks 5-6)
**Focus**: OAuth flows  
**Issues**: #15-#22  
**Team Size**: 2 backend + 1 frontend  
**Deliverable**: Secure authentication working

### Sprint 7-8: Multi-Platform (Weeks 7-8)
**Focus**: Platform APIs + orchestration  
**Issues**: #23-#28  
**Team Size**: 2 backend + 2 frontend  
**Deliverable**: Multi-platform streaming working

### Sprint 9-10: Scenes (Weeks 9-10)
**Focus**: Advanced composition  
**Issues**: #29-#33  
**Team Size**: 2 frontend + 1 canvas expert  
**Deliverable**: Scene editor with overlays

### Sprint 11-12: Audio (Weeks 11-12)
**Focus**: Audio mixing  
**Issues**: #34-#38  
**Team Size**: 1-2 developers (Web Audio experience)  
**Deliverable**: Multi-source audio mixing

### Sprint 13-14: Polish (Weeks 13-14)
**Focus**: Instagram + validators  
**Issues**: #39-#43  
**Team Size**: 2 developers  
**Deliverable**: Instagram support + validation

### Sprint 15-16: Production (Weeks 15-16)
**Focus**: Hardening  
**Issues**: #44-#49  
**Team Size**: 1 DevOps + 1 security + 1 doc writer  
**Deliverable**: Production-ready application

---

## Risk Mitigation

### High-Risk Items
1. **WebRTC NAT Traversal** (#10)
   - Risk: ~10% of users behind symmetric NAT
   - Mitigation: Implement TURN server early

2. **Browser Compatibility** (#10, #29, #34)
   - Risk: Firefox doesn't support WebCodecs
   - Mitigation: Feature detection + fallbacks

3. **Audio/Video Sync** (#38)
   - Risk: Drift over long streams
   - Mitigation: Monitor timestamps, implement correction

4. **OAuth Token Security** (#15-#22)
   - Risk: Token leakage
   - Mitigation: BFF pattern, HttpOnly cookies, OWASP audit

### Medium-Risk Items
1. **Canvas Performance** (#29, #32)
   - Risk: Dropped frames on low-end devices
   - Mitigation: OffscreenCanvas, requestAnimationFrame

2. **MediaMTX Scaling** (#48)
   - Risk: Server overload
   - Mitigation: Load testing, horizontal scaling plan

---

## Success Metrics

### Phase 1 Success
- [ ] getUserMedia works on HTTPS
- [ ] < 100ms preview latency
- [ ] 80%+ test coverage

### Phase 2 Success
- [ ] WebRTC connects in < 2s
- [ ] RTMP output verified with VLC
- [ ] Stats update every second

### Phase 3 Success
- [ ] Tokens never in localStorage
- [ ] CSRF protection working
- [ ] OAuth flows complete successfully

### Phase 4 Success
- [ ] Simultaneous Twitch + YouTube working
- [ ] Errors on one platform don't affect others
- [ ] Stream health dashboard accurate

### Phase 5-7 Success
- [ ] Scene composition at 60fps
- [ ] Audio stays in sync (< 50ms)
- [ ] Instagram vertical streaming works

### Phase 8 Success
- [ ] OWASP Top 10 compliant
- [ ] Bundle < 500KB
- [ ] MediaMTX handles 10+ streams
- [ ] Deployment docs complete

---

## Quick Start for New Developers

1. **Read these documents**:
   - `STREAMING_IMPLEMENTATION_PLAYBOOK.md`
   - `.claude/CLAUDE.md`
   - `ISSUE_BACKLOG.md`

2. **Set up environment**:
   - Complete #6 (HTTPS setup)
   - Install dependencies: `npm install`
   - Run dev server: `npm start`

3. **Pick your first issue**:
   - Start with #1 if nothing exists
   - Pick any unassigned P0 issue if ready
   - Check dependencies before starting

4. **Follow the checklist**:
   - Read acceptance criteria
   - Implement feature
   - Write tests (TDD preferred)
   - Verify all checkboxes met
   - Create PR

5. **Get help**:
   - Playbook has detailed implementation examples
   - Issues have technical notes
   - Test utilities show patterns

---

## Architecture Decision Records (ADRs)

### ADR-001: WebRTC → MediaMTX → RTMP
**Decision**: Use MediaMTX as gateway  
**Rationale**: Browsers cannot send RTMP natively  
**Trade-offs**: Requires server infrastructure, adds latency (~100-200ms)

### ADR-002: Backend-for-Frontend (BFF) Pattern
**Decision**: Backend handles OAuth, Angular never sees tokens  
**Rationale**: Browsers cannot securely store secrets  
**Trade-offs**: More complex architecture, requires Node.js backend

### ADR-003: Signals for State Management
**Decision**: Use Angular signals instead of RxJS for state  
**Rationale**: Modern Angular pattern, better performance  
**Trade-offs**: Different from older Angular apps

### ADR-004: Standalone Components
**Decision**: No NgModules  
**Rationale**: Angular 17+ best practice  
**Trade-offs**: Not compatible with older tutorials

### ADR-005: H.264 Codec Only
**Decision**: Force H.264 baseline profile  
**Rationale**: Universal platform support  
**Trade-offs**: Less efficient than VP9/AV1

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-14  
**Maintained By**: Product Owner  
**Status**: Ready for Implementation
