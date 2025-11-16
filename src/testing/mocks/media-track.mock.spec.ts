import { describe, it, expect } from 'vitest';
import { createMockMediaStreamTrack } from './media-track.mock';

describe('createMockMediaStreamTrack', () => {
  it('should create a video track with default configuration', () => {
    const track = createMockMediaStreamTrack();

    expect(track).toBeDefined();
    expect(track.kind).toBe('video');
    expect(track.label).toBe('Mock Camera');
    expect(track.enabled).toBe(true);
    expect(track.muted).toBe(false);
    expect(track.readyState).toBe('live');
  });

  it('should create a video track with unique ID', () => {
    const track1 = createMockMediaStreamTrack();
    const track2 = createMockMediaStreamTrack();

    expect(track1.id).toBeDefined();
    expect(track2.id).toBeDefined();
    expect(track1.id).not.toBe(track2.id);
  });

  it('should create an audio track when kind is audio', () => {
    const track = createMockMediaStreamTrack({ kind: 'audio' });

    expect(track.kind).toBe('audio');
    expect(track.label).toBe('Mock Microphone');
  });

  it('should use custom label when provided', () => {
    const track = createMockMediaStreamTrack({ label: 'Custom Label' });

    expect(track.label).toBe('Custom Label');
  });

  it('should use custom ID when provided', () => {
    const customId = 'custom-track-id';
    const track = createMockMediaStreamTrack({ id: customId });

    expect(track.id).toBe(customId);
  });

  it('should create track with custom enabled state', () => {
    const track = createMockMediaStreamTrack({ enabled: false });

    expect(track.enabled).toBe(false);
  });

  it('should create track with custom muted state', () => {
    const track = createMockMediaStreamTrack({ muted: true });

    expect(track.muted).toBe(true);
  });

  it('should create track with custom readyState', () => {
    const track = createMockMediaStreamTrack({ readyState: 'ended' });

    expect(track.readyState).toBe('ended');
  });

  it('should have stop method that can be called', () => {
    const track = createMockMediaStreamTrack();

    expect(track.stop).toBeDefined();
    expect(typeof track.stop).toBe('function');
    expect(() => track.stop()).not.toThrow();
  });

  it('should have getSettings method that returns settings', () => {
    const customSettings = { width: 1280, height: 720, frameRate: 60 };
    const track = createMockMediaStreamTrack({
      kind: 'video',
      settings: customSettings,
    });

    const settings = track.getSettings();
    expect(settings.width).toBe(1280);
    expect(settings.height).toBe(720);
    expect(settings.frameRate).toBe(60);
  });

  it('should return default video settings for video track', () => {
    const track = createMockMediaStreamTrack({ kind: 'video' });

    const settings = track.getSettings();
    expect(settings.width).toBe(1920);
    expect(settings.height).toBe(1080);
    expect(settings.frameRate).toBe(30);
  });

  it('should return default audio settings for audio track', () => {
    const track = createMockMediaStreamTrack({ kind: 'audio' });

    const settings = track.getSettings();
    expect(settings.sampleRate).toBe(48000);
    expect(settings.channelCount).toBe(2);
  });

  it('should have getCapabilities method', () => {
    const track = createMockMediaStreamTrack();

    expect(track.getCapabilities).toBeDefined();
    expect(typeof track.getCapabilities).toBe('function');
  });

  it('should have getConstraints method', () => {
    const track = createMockMediaStreamTrack();

    expect(track.getConstraints).toBeDefined();
    expect(typeof track.getConstraints).toBe('function');
  });

  it('should have applyConstraints method that returns a promise', async () => {
    const track = createMockMediaStreamTrack();

    expect(track.applyConstraints).toBeDefined();
    await expect(track.applyConstraints({})).resolves.toBeUndefined();
  });

  it('should have addEventListener method', () => {
    const track = createMockMediaStreamTrack();

    expect(track.addEventListener).toBeDefined();
    expect(typeof track.addEventListener).toBe('function');
  });

  it('should have removeEventListener method', () => {
    const track = createMockMediaStreamTrack();

    expect(track.removeEventListener).toBeDefined();
    expect(typeof track.removeEventListener).toBe('function');
  });
});
