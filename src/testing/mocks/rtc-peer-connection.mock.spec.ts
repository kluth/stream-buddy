import { describe, it, expect } from 'vitest';
import { createMockRTCPeerConnection } from './rtc-peer-connection.mock';

describe('createMockRTCPeerConnection', () => {
  it('should create RTCPeerConnection with default configuration', () => {
    const pc = createMockRTCPeerConnection();

    expect(pc).toBeDefined();
    expect(pc.connectionState).toBe('new');
    expect(pc.iceConnectionState).toBe('new');
    expect(pc.iceGatheringState).toBe('new');
    expect(pc.signalingState).toBe('stable');
  });

  it('should use custom connectionState when provided', () => {
    const pc = createMockRTCPeerConnection({ connectionState: 'connected' });

    expect(pc.connectionState).toBe('connected');
  });

  it('should use custom iceConnectionState when provided', () => {
    const pc = createMockRTCPeerConnection({ iceConnectionState: 'connected' });

    expect(pc.iceConnectionState).toBe('connected');
  });

  it('should use custom iceGatheringState when provided', () => {
    const pc = createMockRTCPeerConnection({ iceGatheringState: 'complete' });

    expect(pc.iceGatheringState).toBe('complete');
  });

  it('should use custom signalingState when provided', () => {
    const pc = createMockRTCPeerConnection({ signalingState: 'have-local-offer' });

    expect(pc.signalingState).toBe('have-local-offer');
  });

  it('should have addTrack method', () => {
    const pc = createMockRTCPeerConnection();

    expect(pc.addTrack).toBeDefined();
    expect(typeof pc.addTrack).toBe('function');
  });

  it('should have removeTrack method', () => {
    const pc = createMockRTCPeerConnection();

    expect(pc.removeTrack).toBeDefined();
    expect(typeof pc.removeTrack).toBe('function');
  });

  it('should have createOffer method that returns a promise', async () => {
    const pc = createMockRTCPeerConnection();

    const offer = await pc.createOffer();
    expect(offer).toBeDefined();
    expect(offer.type).toBe('offer');
    expect(offer.sdp).toBeDefined();
  });

  it('should have createAnswer method that returns a promise', async () => {
    const pc = createMockRTCPeerConnection();

    const answer = await pc.createAnswer();
    expect(answer).toBeDefined();
    expect(answer.type).toBe('answer');
    expect(answer.sdp).toBeDefined();
  });

  it('should have setLocalDescription method that returns a promise', async () => {
    const pc = createMockRTCPeerConnection();

    await expect(
      pc.setLocalDescription({ type: 'offer', sdp: 'test-sdp' })
    ).resolves.toBeUndefined();
  });

  it('should have setRemoteDescription method that returns a promise', async () => {
    const pc = createMockRTCPeerConnection();

    await expect(
      pc.setRemoteDescription({ type: 'offer', sdp: 'test-sdp' })
    ).resolves.toBeUndefined();
  });

  it('should have addIceCandidate method that returns a promise', async () => {
    const pc = createMockRTCPeerConnection();

    await expect(pc.addIceCandidate({})).resolves.toBeUndefined();
  });

  it('should have getSenders method that returns empty array by default', () => {
    const pc = createMockRTCPeerConnection();

    const senders = pc.getSenders();
    expect(Array.isArray(senders)).toBe(true);
    expect(senders.length).toBe(0);
  });

  it('should have getReceivers method that returns empty array by default', () => {
    const pc = createMockRTCPeerConnection();

    const receivers = pc.getReceivers();
    expect(Array.isArray(receivers)).toBe(true);
    expect(receivers.length).toBe(0);
  });

  it('should have getTransceivers method that returns empty array by default', () => {
    const pc = createMockRTCPeerConnection();

    const transceivers = pc.getTransceivers();
    expect(Array.isArray(transceivers)).toBe(true);
    expect(transceivers.length).toBe(0);
  });

  it('should have getStats method that returns a promise', async () => {
    const pc = createMockRTCPeerConnection();

    const stats = await pc.getStats();
    expect(stats).toBeDefined();
  });

  it('should have close method', () => {
    const pc = createMockRTCPeerConnection();

    expect(pc.close).toBeDefined();
    expect(typeof pc.close).toBe('function');
    expect(() => pc.close()).not.toThrow();
  });

  it('should have addEventListener method', () => {
    const pc = createMockRTCPeerConnection();

    expect(pc.addEventListener).toBeDefined();
    expect(typeof pc.addEventListener).toBe('function');
  });

  it('should have removeEventListener method', () => {
    const pc = createMockRTCPeerConnection();

    expect(pc.removeEventListener).toBeDefined();
    expect(typeof pc.removeEventListener).toBe('function');
  });

  it('should track method calls using vi.fn()', async () => {
    const pc = createMockRTCPeerConnection();

    await pc.createOffer();
    pc.getSenders();

    expect(pc.createOffer).toHaveBeenCalled();
    expect(pc.getSenders).toHaveBeenCalled();
  });
});
