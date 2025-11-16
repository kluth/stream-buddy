import { describe, it, expect, vi } from 'vitest';
import { createMockMediaStream } from './media-stream.mock';

describe('createMockMediaStream', () => {
  it('should create a MediaStream with default configuration', () => {
    const stream = createMockMediaStream();

    expect(stream).toBeDefined();
    expect(stream.id).toBeDefined();
    expect(stream.active).toBe(true);
  });

  it('should create MediaStream with unique ID', () => {
    const stream1 = createMockMediaStream();
    const stream2 = createMockMediaStream();

    expect(stream1.id).toBeDefined();
    expect(stream2.id).toBeDefined();
    expect(stream1.id).not.toBe(stream2.id);
  });

  it('should use custom ID when provided', () => {
    const customId = 'custom-stream-id';
    const stream = createMockMediaStream({ id: customId });

    expect(stream.id).toBe(customId);
  });

  it('should use custom active state when provided', () => {
    const stream = createMockMediaStream({ active: false });

    expect(stream.active).toBe(false);
  });

  it('should create one video track by default', () => {
    const stream = createMockMediaStream();

    const tracks = stream.getTracks();
    expect(tracks.length).toBe(1);
    expect(tracks[0].kind).toBe('video');
  });

  it('should create multiple video tracks when configured', () => {
    const stream = createMockMediaStream({
      videoTracks: [{}, {}],
    });

    const tracks = stream.getVideoTracks();
    expect(tracks.length).toBe(2);
    expect(tracks[0].kind).toBe('video');
    expect(tracks[1].kind).toBe('video');
  });

  it('should create audio tracks when configured', () => {
    const stream = createMockMediaStream({
      videoTracks: [],
      audioTracks: [{}],
    });

    const tracks = stream.getAudioTracks();
    expect(tracks.length).toBe(1);
    expect(tracks[0].kind).toBe('audio');
  });

  it('should create both video and audio tracks', () => {
    const stream = createMockMediaStream({
      videoTracks: [{}],
      audioTracks: [{}],
    });

    const allTracks = stream.getTracks();
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();

    expect(allTracks.length).toBe(2);
    expect(videoTracks.length).toBe(1);
    expect(audioTracks.length).toBe(1);
  });

  it('should allow custom track configuration', () => {
    const stream = createMockMediaStream({
      videoTracks: [{ label: 'Custom Camera', id: 'cam-1' }],
    });

    const videoTracks = stream.getVideoTracks();
    expect(videoTracks[0].label).toBe('Custom Camera');
    expect(videoTracks[0].id).toBe('cam-1');
  });

  it('should have getTracks method that returns all tracks', () => {
    const stream = createMockMediaStream({
      videoTracks: [{}],
      audioTracks: [{}],
    });

    const tracks = stream.getTracks();
    expect(Array.isArray(tracks)).toBe(true);
    expect(tracks.length).toBe(2);
  });

  it('should have getVideoTracks method that returns only video tracks', () => {
    const stream = createMockMediaStream({
      videoTracks: [{}, {}],
      audioTracks: [{}],
    });

    const videoTracks = stream.getVideoTracks();
    expect(videoTracks.length).toBe(2);
    expect(videoTracks.every((t) => t.kind === 'video')).toBe(true);
  });

  it('should have getAudioTracks method that returns only audio tracks', () => {
    const stream = createMockMediaStream({
      videoTracks: [{}],
      audioTracks: [{}, {}],
    });

    const audioTracks = stream.getAudioTracks();
    expect(audioTracks.length).toBe(2);
    expect(audioTracks.every((t) => t.kind === 'audio')).toBe(true);
  });

  it('should have getTrackById method that finds track by ID', () => {
    const stream = createMockMediaStream({
      videoTracks: [{ id: 'track-1' }, { id: 'track-2' }],
    });

    const track = stream.getTrackById('track-1');
    expect(track).toBeDefined();
    expect(track?.id).toBe('track-1');
  });

  it('should return null when getTrackById does not find track', () => {
    const stream = createMockMediaStream();

    const track = stream.getTrackById('non-existent-id');
    expect(track).toBeNull();
  });

  it('should have addTrack method', () => {
    const stream = createMockMediaStream();

    expect(stream.addTrack).toBeDefined();
    expect(typeof stream.addTrack).toBe('function');
  });

  it('should have removeTrack method', () => {
    const stream = createMockMediaStream();

    expect(stream.removeTrack).toBeDefined();
    expect(typeof stream.removeTrack).toBe('function');
  });

  it('should have addEventListener method', () => {
    const stream = createMockMediaStream();

    expect(stream.addEventListener).toBeDefined();
    expect(typeof stream.addEventListener).toBe('function');
  });

  it('should have removeEventListener method', () => {
    const stream = createMockMediaStream();

    expect(stream.removeEventListener).toBeDefined();
    expect(typeof stream.removeEventListener).toBe('function');
  });

  it('should track calls to methods using vi.fn()', () => {
    const stream = createMockMediaStream();

    stream.getTracks();
    stream.getVideoTracks();

    expect(stream.getTracks).toHaveBeenCalled();
    expect(stream.getVideoTracks).toHaveBeenCalled();
  });
});
