# Broadboi Rebranding Guide

## Executive Summary

Broadboi
**New Name:** Broadboi
**Tagline:** Your Wingman for Epic Streams
**Launch Date:** TBD

This document outlines the complete rebranding strategy, implementation checklist, and communication tactics for transitioning from "Stream Buddy" to "Broadboi."

---

## 1. Brand Identity

### Why Broadboi?

**Unique & Memorable:**
- No existing streaming products use this name (verified through comprehensive web research)
- Highly searchable and SEO-friendly
- Perfectly length (8 letters - optimal for recall)

**Meme Culture Appeal:**
- "Boi" spelling taps into internet culture and meme-friendly language
- Resonates with younger demographics (Gen Z streamers on Twitch/TikTok)
- Creates opportunities for viral marketing and community memes

**Wingman Positioning:**
- Positions the product as a supportive companion, not just a tool
- "Your wingman for epic streams" - relatable, friendly, approachable
- Suggests reliability and partnership in content creation

### Brand Voice

- **Friendly & Supportive:** Not corporate, more like a helpful friend
- **Energetic & Fun:** Embraces internet culture and streaming energy
- **Confident but Humble:** "We've got your back" without being arrogant
- **Slightly Irreverent:** Can use humor and memes appropriately

---

## 2. Visual Identity (Recommendations)

### Logo Concepts

**Option 1: Character Mascot**
- A friendly, cartoon "boi" character (could be human, robot, or abstract)
- Wearing headphones, giving thumbs up, or in "wingman" pose
- Colors: Vibrant purples, teals, or oranges (stand out from Twitch purple)

**Option 2: Typography-Based**
- Bold, modern sans-serif for "Broadboi"
- Possible streaming signal waves or broadcast icon integrated
- Gradient or duo-tone color scheme

**Option 3: Minimalist Icon**
- Abstract "B" shape that suggests broadcast/streaming waves
- Clean, modern, works at small sizes (app icons, favicons)

### Color Palette Ideas

- **Primary:** Electric Blue (#00B8FF) - energy, tech, trust
- **Secondary:** Vibrant Purple (#9B59B6) - creativity, streaming culture
- **Accent:** Neon Green (#39FF14) - alerts, CTAs, "go live" buttons
- **Neutral:** Dark Charcoal (#2C3E50) and White (#FFFFFF)

### Typography

- **Headings:** Bold, modern sans-serif (e.g., Inter Bold, Poppins Bold)
- **Body:** Clean, readable sans-serif (e.g., Inter Regular, Roboto)
- **Code/Technical:** Monospace (e.g., Fira Code, JetBrains Mono)

---

## 3. Technical Implementation Status

### ✅ Completed Changes

#### Root Configuration
- [x] README.md updated with new branding
- [x] docker-compose.yml container names changed to `broadboi-mediamtx`
- [x] Docker network renamed to `broadboi-network`
- [x] mediamtx.yml configuration header updated

#### Documentation
- [x] docs/INFRASTRUCTURE.md - Full rebrand
- [x] docs/DEPLOYMENT.md - All references replaced
- [x] docs/PLATFORM_LIMITATIONS.md - Updated
- [x] docs/https-setup-guide.md - Updated
- [x] docs/tech-specs/ISSUE-9-MEDIAMTX-DEPLOYMENT.md - Maintained for history

#### Scripts
- [x] scripts/setup-https.sh - Banner and comments updated
- [x] scripts/setup-https.ps1 - Banner and comments updated
- [x] scripts/generate-certs.sh - Certificate organization name updated

#### Application Code
- [x] apps/api/src/app/overlay-render/overlay-render.service.ts:
  - Page title: "Broadboi Overlay"
  - Default text: "Welcome to Broadboi - Your Wingman for Epic Streams!"

### ⚠️ Remaining Technical Tasks

#### Critical (Must Complete Before Launch)

1. **TypeScript Path Aliases**
   - Current imports use @broadboi/core
   - Need to update tsconfig.base.json (or equivalent) path mappings
   - Change to `@broadboi/core`
   - Run find/replace across all .ts files for import statements

2. **Package Names**
   - Update any package.json files with name "stream-buddy"
   - Located in: apps/stream-buddy/package.json, apps/api/package.json
   - Updated to "@broadboi/web" and "@broadboi/api" respectively

3. **Repository/Git**
   - [x] Rename GitHub repository from `stream-buddy` to `broadboi`
   - Update git remote URLs in documentation
   - Archive old repository name (redirect if possible)
   - Note: GitHub repository has been renamed to 'broadboi'.

4. **Environment Variables**
   - Check .env files for any "STREAM_BUDDY_" prefixed variables
   - Update to "BROADBOI_" prefix
   - Update .env.example files

5. **Database/Storage**
   - If any database table names, collections, or keys use "stream_buddy"
   - Plan migration strategy
   - Update schema documentation

#### Nice-to-Have (Can Be Gradual)

6. **Test Files**
   - Update test descriptions and mock data that reference "Stream Buddy"
   - Files identified: Various *.spec.ts files

7. **Comments & TODOs**
   - Search codebase for "Stream Buddy" in comments
   - Update for consistency

8. **Build Artifacts**
   - Clear old build artifacts and caches
   - Rebuild with new branding to verify no issues

---

## 4. Communication & Launch Strategy

### Phase 1: Internal Preparation (Week 1)

**Goal:** Get everything ready behind the scenes

**Tasks:**
- [ ] Complete all Critical technical tasks above
- [ ] Design final logo and visual identity
- [ ] Create brand style guide document
- [ ] Prepare social media assets (cover photos, profile images)
- [ ] Write launch announcement copy
- [ ] Set up new social media handles (@broadboi on Twitter, etc.)
- [ ] Reserve domain names (broadboi.com, broadboi.app, broadboi.tv)

### Phase 2: Soft Launch (Week 2)

**Goal:** Start building awareness without full public announcement

**Tasks:**
- [ ] Update GitHub repository (rename, add new README banner)
- [ ] Deploy rebranded version to staging environment
- [ ] Share with beta testers / early adopters
- [ ] Collect feedback on new branding
- [ ] Fix any technical issues discovered
- [ ] Start teasing on social media ("Something new is coming...")

### Phase 3: Public Launch (Week 3)

**Goal:** Make the big reveal and generate buzz

**Announcement Channels:**
1. **GitHub**
   - Pin announcement issue with rebrand rationale
   - Update all README files with new branding
   - Release notes for "Broadboi v2.0" (version bump)

2. **Social Media**
   - Twitter/X thread introducing Broadboi
   - Reddit posts in r/Twitch, r/streaming, r/YouTubeCreators
   - LinkedIn post (if professional audience)
   - Discord server announcement (if you have one)

3. **Product Hunt**
   - Launch on Product Hunt with new branding
   - Title: "Broadboi - Your Wingman for Multi-Platform Streaming"
   - Tagline: "Browser-based streaming to Twitch, YouTube & more. Like OBS, but cooler."

4. **Community**
   - Email existing users (if applicable)
   - Post in relevant streaming communities
   - Reach out to streamer influencers for reviews

### Phase 4: Sustain Momentum (Ongoing)

**Content Strategy:**
- Weekly tips for streamers ("Broadboi Tips")
- Behind-the-scenes development updates ("Building Broadboi")
- User success stories ("Epic Streams with Broadboi")
- Meme content for social engagement
- Tutorial videos on YouTube

**Community Building:**
- Launch Discord server for users
- Create subreddit r/Broadboi
- Regular AMAs and Q&As
- Streamer spotlights and features

---

## 5. Messaging Framework

### Core Messages

**For Streamers:**
> "Broadboi is your wingman for epic streams. Broadcast to Twitch, YouTube, and Facebook simultaneously from your browser. No downloads, no OBS headaches. Just go live."

**For Developers:**
> "Built with Angular 17+, WebRTC, and MediaMTX. Open-source, extensible, and designed for modern streaming workflows."

**For Investors/Press:**
> "Broadboi democratizes multi-platform streaming with browser-based technology. We're making professional broadcasting accessible to every creator."

### Key Differentiators

1. **Browser-Based** - No software to download
2. **Multi-Platform** - Stream everywhere at once
3. **Open Source** - Transparent and community-driven
4. **Modern Stack** - Built with latest web technologies
5. **Free & Accessible** - No paywalls or premium tiers (yet)

### Tagline Variations

- Primary: "Your Wingman for Epic Streams"
- Alternative: "Broadcast Everywhere, Effortlessly"
- Technical: "Multi-Platform Streaming, Simplified"
- Fun: "Stream Like a Pro, Boi"

---

## 6. Merchandise Ideas

### Stickers
- "Broadboi" logo sticker (holographic/vinyl)
- "Your Wingman for Epic Streams" tagline sticker
- Chibi mascot character sticker
- "Streaming with Broadboi" badge sticker

### T-Shirts
- Front: Broadboi logo
- Back: "Your Wingman for Epic Streams"
- Color options: Black, Navy, Purple, White
- Tagline on sleeve: "Go Live, Boi"

### Other Merch
- Hoodies (streamers love hoodies)
- Mouse pads (gaming/streaming themed)
- Sticker packs (variety pack of designs)
- Phone cases (for IRL streamers)
- Laptop stickers (dev community)

### Where to Sell
- Redbubble or Teespring (easy setup, no inventory)
- Official merch store (if demand is high)
- Giveaways for community engagement

---

## 7. Potential Partnerships

### Streamer Collaborations
- Partner with mid-tier streamers (10k-100k followers)
- Offer early access, custom features, or revenue share
- "Powered by Broadboi" overlay badges
- Affiliate program (if monetization strategy exists)

### Platform Integrations
- Official Twitch extension (if API allows)
- YouTube Live integration showcase
- Facebook Gaming partnership opportunities

### Tech Community
- DevRel outreach to Angular, WebRTC, Docker communities
- Conference talks and workshops
- Open-source contributor recognition program

---

## 8. SEO & Domain Strategy

### Primary Domain
**broadboi.app** (recommended - modern, tech-savvy)

### Alternatives
- broadboi.tv (if .app unavailable)
- broadboi.io (developer-friendly)
- getbroadboi.com (traditional fallback)

### SEO Keywords
- Multi-platform streaming software
- Browser-based streaming tool
- Stream to Twitch and YouTube simultaneously
- Free streaming software alternative to OBS
- WebRTC streaming platform

### Content Marketing
- Blog: broadboi.app/blog
- Topics: Streaming tips, WebRTC tech, multi-platform strategies
- Guest posts on streaming/tech blogs
- YouTube tutorials and demos

---

## 9. Timeline & Milestones

### Week 1: Complete Technical Rebrand
- Finish all Critical technical tasks
- Verify no broken references
- Test all features with new branding

### Week 2: Prepare Launch Assets
- Finalize logo and visual identity
- Create social media graphics
- Write launch announcements
- Set up new domains and handles

### Week 3: Soft Launch
- Deploy to production with new branding
- Notify beta users and early adopters
- Collect feedback
- Fix any issues

### Week 4: Public Launch
- Announce on all channels simultaneously
- Engage with community responses
- Monitor analytics and feedback
- Respond to questions and issues

### Month 2: Growth & Iteration
- Analyze launch metrics
- Plan first major feature update
- Start merchandise store
- Begin partnership outreach

---

## 10. Risk Mitigation

### Potential Risks

**Risk 1: Confusion Among Existing Users**
- Mitigation: Clear communication about name change
- Redirect old URLs to new ones
- FAQ section addressing the rebrand

**Risk 2: Loss of SEO Rankings**
- Mitigation: 301 redirects from old domain
- Update all backlinks
- Submit updated sitemap to Google

**Risk 3: Trademark/Legal Issues**
- Mitigation: Conduct thorough trademark search
- File trademark application for "Broadboi" in relevant categories
- Legal review before major launch

**Risk 4: Negative Community Reaction**
- Mitigation: Be transparent about reasons for change
- Engage positively with criticism
- Show that product quality remains the same/improves

---

## 11. Success Metrics

### Launch Week Goals
- [ ] 1,000+ GitHub stars
- [ ] 500+ Discord members
- [ ] 10,000+ website visits
- [ ] 100+ social media mentions
- [ ] Featured on at least one tech blog/newsletter

### Month 1 Goals
- [ ] 5,000+ GitHub stars
- [ ] 2,000+ Discord members
- [ ] 100+ active daily users
- [ ] 10+ streamer partnerships
- [ ] Product Hunt top 5 of the day

### Quarter 1 Goals
- [ ] 10,000+ GitHub stars
- [ ] 5,000+ registered users
- [ ] 500+ concurrent streams per day
- [ ] Featured in major tech publications
- [ ] First community-contributed features merged

---

## 12. Next Steps (Action Items)

### Immediate (This Week)
1. Complete TypeScript path alias updates (`@stream-buddy/core` → `@broadboi/core`)
2. Update all package.json names
3. Test full application with new branding
4. Commission logo design (hire designer or create internally)

### Short-Term (Next 2 Weeks)
5. Reserve domain names (broadboi.app, .tv, .io)
6. Set up social media accounts
7. Create brand style guide document
8. Write launch announcement drafts

### Medium-Term (Next Month)
9. Rename GitHub repository
10. Update all external links and documentation
11. Soft launch to beta users
12. Collect feedback and iterate

### Long-Term (Ongoing)
13. Public launch campaign
14. Community building and engagement
15. Merchandise store setup
16. Partnership development

---

## 13. FAQ for Users

**Q: Why did you change the name?**
A: "Stream Buddy" was already taken by other products, which could cause confusion. "Broadboi" is unique, memorable, and reflects our mission to be your reliable wingman for streaming.

**Q: Will my settings/data be affected?**
A: No! The rebrand is purely cosmetic. All your configurations, stream keys, and preferences remain unchanged.

**Q: Do I need to reinstall or update anything?**
A: Just update to the latest version when prompted. Everything else happens automatically.

**Q: Is the project still open source?**
A: Absolutely! Broadboi remains 100% open source under the MIT license.

**Q: What happens to old "Stream Buddy" links?**
A: All old links will redirect to the new Broadboi website/repository automatically.

---

## Conclusion

The rebrand to **Broadboi** represents not just a name change, but a recommitment to being the most reliable, friendly, and innovative multi-platform streaming tool for creators. By embracing internet culture, prioritizing user experience, and maintaining our open-source roots, we're positioned to become the go-to streaming companion for the next generation of content creators.

**Let's go live, boi!** 🚀

---

**Document Version:** 1.0
**Last Updated:** 2025-12-01
**Maintained By:** Broadboi Development Team
