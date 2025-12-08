import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { WebRTCGatewayService, type WebRTCGatewayConfig, type ConnectionMetrics } from './webrtc-gateway.service';
import { WEBRTC_GATEWAY_CONFIG } from './webrtc-gateway.config';
import type { ConnectionState } from '../models/webrtc-gateway.types';
import * as helpers from './webrtc-gateway.helpers'; // Keep import for type inference or if needed for actual implementation logic

// Mock WebRTC globals directly in the test file for safety and to control their behavior explicitly.
// These mocks are for the service logic itself, not the helper module (which is mocked above).

let mockPeerConnectionInstance: any; // Declare at top level

class MockRTCPeerConnection {
  constructor(...args: any[]) {
    // Store constructor args if needed for assertion
    mockPeerConnectionInstance.constructorArgs = args;
    return mockPeerConnectionInstance;
  }
}

class MockRTCSessionDescription {
  type: RTCSdpType;
  sdp: string;
  constructor(init: RTCSessionDescriptionInit) {
    this.type = init.type;
    this.sdp = init.sdp || '';
  }
  toJSON() { return { type: this.type, sdp: this.sdp }; }
}

class MockRTCIceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  constructor(init: RTCIceCandidateInit) {
    this.candidate = init.candidate || '';
    this.sdpMid = init.sdpMid || null;
    this.sdpMLineIndex = init.sdpMLineIndex || null;
  }
  toJSON() { return { candidate: this.candidate, sdpMid: this.sdpMid, sdpMLineIndex: this.sdpMLineIndex }; }
}

async function simulateSuccessfulConnection(
  peerConnection: any,
  offer: RTCSessionDescriptionInit,
  gatewayService: WebRTCGatewayService,
  stream: MediaStream
) {
  // Simulate ICE gathering complete
  Object.defineProperty(peerConnection, 'iceGatheringState', { value: 'complete', configurable: true });
  Object.defineProperty(peerConnection, 'localDescription', { value: offer, configurable: true });

  const iceGatheringHandler = vi.mocked(peerConnection.addEventListener).mock.calls
    .find(call => call[0] === 'icegatheringstatechange')?.[1];
  if (iceGatheringHandler) {
    iceGatheringHandler();
  }

  // Simulate connection
  Object.defineProperty(peerConnection, 'connectionState', { value: 'connected', configurable: true });
  const connectionHandler = vi.mocked(peerConnection.addEventListener).mock.calls
    .find(call => call[0] === 'connectionstatechange')?.[1];
  if (connectionHandler) {
    connectionHandler();
  }

  // Wait for the connection to be established
  await gatewayService.createConnection(stream);
}

describe('WebRTCGatewayService', () => {
  let service: WebRTCGatewayService;
  let mockMediaStream: any;
  let originalRTCPeerConnection: typeof RTCPeerConnection;
  let originalRTCSessionDescription: typeof RTCSessionDescription;
  let originalRTCIceCandidate: typeof RTCIceCandidate;
  let originalFetch: typeof fetch;

  const mockConfig: WebRTCGatewayConfig = {
    whipUrl: 'http://localhost:8889/live/whip',
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    codecPreferences: ['video/H264', 'audio/opus'],
    connectionTimeout: 10000
  };

  beforeEach(() => {
    // Save original globals
    originalRTCPeerConnection = window.RTCPeerConnection;
    originalRTCSessionDescription = window.RTCSessionDescription;
    originalRTCIceCandidate = window.RTCIceCandidate;
    originalFetch = window.fetch;

    // Create mock MediaStream
    const mockVideoTrack = {
      kind: 'video',
      stop: vi.fn()
    } as unknown as MediaStreamTrack;
    const mockAudioTrack = {
      kind: 'audio',
      stop: vi.fn()
    } as unknown as MediaStreamTrack;

    mockMediaStream = {
      getTracks: vi.fn().mockReturnValue([mockVideoTrack, mockAudioTrack]),
      getAudioTracks: vi.fn().mockReturnValue([mockAudioTrack]),
      getVideoTracks: vi.fn().mockReturnValue([mockVideoTrack])
    };

    // Initialize the mockPeerConnectionInstance with fresh spies for each test
    mockPeerConnectionInstance = {
      addTrack: vi.fn(),
      createOffer: vi.fn(),
      setLocalDescription: vi.fn(),
      setRemoteDescription: vi.fn(),
      close: vi.fn(),
      getTransceivers: vi.fn(),
      getStats: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      connectionState: 'new',
      iceGatheringState: 'new',
      iceConnectionState: 'new',
      localDescription: null,
      onicecandidate: null,
      onconnectionstatechange: null,
      onicegatheringstatechange: null,
      oniceconnectionstatechange: null,
      // Store constructor args if needed for assertion
      constructorArgs: undefined as RTCConfiguration | undefined,
    };

    // Mock RTCPeerConnection constructor using Object.defineProperty
    Object.defineProperty(window, 'RTCPeerConnection', {
      writable: true,
      configurable: true,
      value: vi.fn(function (config?: RTCConfiguration) {
        mockPeerConnectionInstance.constructorArgs = config;
        return mockPeerConnectionInstance;
      }),
    });

    Object.defineProperty(window, 'RTCSessionDescription', {
      writable: true,
      configurable: true,
      value: MockRTCSessionDescription,
    });

    Object.defineProperty(window, 'RTCIceCandidate', {
      writable: true,
      configurable: true,
      value: MockRTCIceCandidate,
    });

    // Mock RTCRtpSender.getCapabilities (RTCRtpSender might not exist in happy-dom)
    if (typeof RTCRtpSender === 'undefined') {
      (global as any).RTCRtpSender = {
        getCapabilities: vi.fn()
      };
    }
    vi.spyOn(RTCRtpSender, 'getCapabilities').mockReturnValue({
      codecs: [
        {
          mimeType: 'video/H264',
          clockRate: 90000,
          sdpFmtpLine: 'profile-level-id=42e01f'
        } as RTCRtpCodecCapability,
        {
          mimeType: 'audio/opus',
          clockRate: 48000
        } as RTCRtpCodecCapability
      ],
      headerExtensions: []
    });

    // Spy on helper functions
    vi.spyOn(helpers, 'forceCodecPreferences');
    vi.spyOn(helpers, 'waitForICEGatheringComplete');
    vi.spyOn(helpers, 'waitForConnection');


    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        WebRTCGatewayService,
        { provide: WEBRTC_GATEWAY_CONFIG, useValue: mockConfig }
      ]
    });

    service = TestBed.inject(WebRTCGatewayService);
  });

  afterEach(() => {
    // Restore original globals
    window.RTCPeerConnection = originalRTCPeerConnection;
    window.RTCSessionDescription = originalRTCSessionDescription;
    window.RTCIceCandidate = originalRTCIceCandidate;
    window.fetch = originalFetch;
    if (service) {
      service.closeConnection();
    }
  });

  describe('initial state', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have initial connectionState as "new"', () => {
      expect(service.connectionState()).toBe('new');
    });

    it('should have no current stream', () => {
      expect(service.currentStream()).toBeNull();
    });

    it('should have no metrics', () => {
      expect(service.metrics()).toBeNull();
    });

    it('should have no error', () => {
      expect(service.error()).toBeNull();
    });

    it('should not be connected initially', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should not be connecting initially', () => {
      expect(service.isConnecting()).toBe(false);
    });

    it('should not have error initially', () => {
      expect(service.hasError()).toBe(false);
    });
  });

  describe('createConnection()', () => {
    let mockOffer: RTCSessionDescriptionInit;
    let mockAnswer: RTCSessionDescription;

    beforeEach(() => {
      mockOffer = { type: 'offer', sdp: 'mock-sdp-offer' };
      mockAnswer = new RTCSessionDescription({ type: 'answer', sdp: 'mock-sdp-answer' });

      vi.mocked(mockPeerConnectionInstance.createOffer).mockResolvedValue(mockOffer);
      vi.spyOn(mockPeerConnectionInstance, 'setLocalDescription').mockImplementation((sdp) => {
        mockPeerConnectionInstance.localDescription = sdp;
        return Promise.resolve();
      });
      vi.spyOn(mockPeerConnectionInstance, 'setRemoteDescription').mockImplementation((sdp) => {
        mockPeerConnectionInstance.remoteDescription = sdp;
        return Promise.resolve();
      });
      vi.mocked(mockPeerConnectionInstance.getTransceivers).mockReturnValue([]);
      vi.mocked(mockPeerConnectionInstance.getStats).mockResolvedValue(new Map());

      // Mock fetch for WHIP negotiation
      window.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response('mock-sdp-answer', { status: 201 }))
      );

      // Explicitly spy on helper functions used in createConnection
      vi.spyOn(helpers, 'waitForICEGatheringComplete').mockResolvedValue(undefined);
      vi.spyOn(helpers, 'waitForConnection').mockResolvedValue(undefined);
    });

    it('should call forceCodecPreferences with correct preferences', async () => {
      vi.mocked(helpers.forceCodecPreferences).mockClear(); // Clear previous calls
      await simulateSuccessfulConnection(mockPeerConnectionInstance, mockOffer, service, mockMediaStream);
      expect(helpers.forceCodecPreferences).toHaveBeenCalledWith(expect.any(Object), mockConfig.codecPreferences);
    });

    it('should set connectionState to "connecting" when starting', async () => {
      const connectionPromise = service.createConnection(mockMediaStream);
      expect(service.connectionState()).toBe('connecting');
      expect(service.isConnecting()).toBe(true);
      await connectionPromise; // Simulate successful connection once promise resolves
    });

    it('should store the current stream', async () => {
      await simulateSuccessfulConnection(mockPeerConnectionInstance, mockOffer, service, mockMediaStream);
      expect(service.currentStream()).toBe(mockMediaStream);
    });

    it('should create RTCPeerConnection with default ICE servers', async () => {
      await simulateSuccessfulConnection(mockPeerConnectionInstance, mockOffer, service, mockMediaStream);
      expect(window.RTCPeerConnection).toHaveBeenCalledWith({
        iceServers: mockConfig.iceServers
      });
    });

    it('should create RTCPeerConnection with custom ICE servers', async () => {
      const customConfig: Partial<WebRTCGatewayConfig> = {
        iceServers: [
          { urls: 'stun:custom-stun.example.com:3478' },
          { urls: 'turn:custom-turn.example.com:3478', username: 'user', credential: 'pass' }
        ]
      };

      const connectionPromise = service.createConnection(mockMediaStream, customConfig);

      expect(window.RTCPeerConnection).toHaveBeenCalledWith({
        iceServers: customConfig.iceServers
      });

      await simulateSuccessfulConnection(mockPeerConnectionInstance, mockOffer, service, mockMediaStream);
      await connectionPromise;
    });

    it('should add all tracks from stream to peer connection', async () => {
      await simulateSuccessfulConnection(mockPeerConnectionInstance, mockOffer, service, mockMediaStream);
      expect(mockPeerConnectionInstance.addTrack).toHaveBeenCalledTimes(2);
    });

    it('should create SDP offer with correct options', async () => {
      await simulateSuccessfulConnection(mockPeerConnectionInstance, mockOffer, service, mockMediaStream);
      expect(mockPeerConnectionInstance.createOffer).toHaveBeenCalledWith({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
    });

    it('should set local description', async () => {
      await simulateSuccessfulConnection(mockPeerConnectionInstance, mockOffer, service, mockMediaStream);
      expect(mockPeerConnectionInstance.setLocalDescription).toHaveBeenCalledWith(mockOffer);
    });

    it('should negotiate with WHIP endpoint using default URL', async () => {
      await simulateSuccessfulConnection(mockPeerConnectionInstance, mockOffer, service, mockMediaStream);
      expect(window.fetch).toHaveBeenCalledWith(
        'http://localhost:8889/live/whip',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: mockOffer.sdp
        }
      );
    });

    it('should negotiate with WHIP endpoint using custom URL', async () => {
      const customConfig: Partial<WebRTCGatewayConfig> = {
        whipUrl: 'https://custom.example.com/whip'
      };

      const connectionPromise = service.createConnection(mockMediaStream, customConfig);
      await simulateSuccessfulConnection(mockPeerConnectionInstance, mockOffer, service, mockMediaStream);
      await connectionPromise;

      expect(window.fetch).toHaveBeenCalledWith(
        'https://custom.example.com/whip',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' }
        })
      );
    });

    it('should set remote description with WHIP answer', async () => {
      await simulateSuccessfulConnection(mockPeerConnectionInstance, mockOffer, service, mockMediaStream);
      expect(mockPeerConnectionInstance.setRemoteDescription).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'answer',
          sdp: 'mock-sdp-answer'
        })
      );
    });

    it('should set connectionState to "connected" on success', async () => {
      await simulateSuccessfulConnection(mockPeerConnectionInstance, mockOffer, service, mockMediaStream);
      expect(service.connectionState()).toBe('connected');
      expect(service.isConnected()).toBe(true);
    });

    it('should handle WHIP negotiation failure', async () => {
      window.fetch = vi.fn().mockResolvedValue(
        new Response('Not Found', { status: 404, statusText: 'Not Found' })
      );

      // Simulate ICE gathering complete
      Object.defineProperty(mockPeerConnectionInstance, 'iceGatheringState', { value: 'complete', configurable: true });
      Object.defineProperty(mockPeerConnectionInstance, 'localDescription', { value: mockOffer, configurable: true });

      const iceGatheringHandler = vi.mocked(mockPeerConnectionInstance.addEventListener).mock.calls
        .find(call => call[0] === 'icegatheringstatechange')?.[1];

      const connectionPromise = service.createConnection(mockMediaStream);

      if (iceGatheringHandler) {
        iceGatheringHandler();
      }

      await expect(connectionPromise).rejects.toThrow(/WHIP negotiation failed: 404/);
      expect(service.connectionState()).toBe('failed');
      expect(service.hasError()).toBe(true);
    });

    it('should handle connection timeout', async () => {
      const customConfig: Partial<WebRTCGatewayConfig> = {
        connectionTimeout: 100 // Short timeout for testing
      };

      // Simulate ICE gathering complete
      Object.defineProperty(mockPeerConnectionInstance, 'iceGatheringState', { value: 'complete', configurable: true });
      Object.defineProperty(mockPeerConnectionInstance, 'localDescription', { value: mockOffer, configurable: true });

      const iceGatheringHandler = vi.mocked(mockPeerConnectionInstance.addEventListener).mock.calls
        .find(call => call[0] === 'icegatheringstatechange')?.[1];

      // Mock waitForConnection to reject for this specific test case
      vi.spyOn(helpers, 'waitForConnection').mockRejectedValueOnce(new Error('Connection timeout'));

      const connectionPromise = service.createConnection(mockMediaStream, customConfig);

      if (iceGatheringHandler) {
        iceGatheringHandler();
      }

      // Don't simulate connection - let it timeout
      await expect(connectionPromise).rejects.toThrow(/Connection timeout/);
      expect(service.connectionState()).toBe('failed');
      expect(service.hasError()).toBe(true);
    });

    it('should close existing connection before creating new one', async () => {
      // First connection
      await simulateSuccessfulConnection(mockPeerConnectionInstance, mockOffer, service, mockMediaStream);
      const firstPeerConnection = mockPeerConnectionInstance;

      // Reset mocks for second connection
      mockPeerConnectionInstance = {
        addTrack: vi.fn(),
        createOffer: vi.fn(),
        setLocalDescription: vi.fn(),
        setRemoteDescription: vi.fn(),
        close: vi.fn(),
        getTransceivers: vi.fn(),
        getStats: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        connectionState: 'new',
        iceGatheringState: 'new',
        iceConnectionState: 'new',
        localDescription: null,
        onicecandidate: null,
        onconnectionstatechange: null,
        onicegatheringstatechange: null,
        oniceconnectionstatechange: null,
        constructorArgs: undefined as RTCConfiguration | undefined,
      };

      vi.mocked(window.RTCPeerConnection as any).mockClear(); // Clear previous mock
      vi.mocked(window.RTCPeerConnection as any).mockImplementation(function (config?: RTCConfiguration) {
        mockPeerConnectionInstance.constructorArgs = config;
        return mockPeerConnectionInstance;
      });
      vi.mocked(mockPeerConnectionInstance.createOffer).mockResolvedValue(mockOffer);
      vi.mocked(mockPeerConnectionInstance.setLocalDescription).mockResolvedValue(undefined);
      vi.mocked(mockPeerConnectionInstance.setRemoteDescription).mockResolvedValue(undefined);
      vi.mocked(mockPeerConnectionInstance.getTransceivers).mockReturnValue([]);
      vi.mocked(mockPeerConnectionInstance.getStats).mockResolvedValue(new Map());

      // Second connection
      await simulateSuccessfulConnection(mockPeerConnectionInstance, mockOffer, service, mockMediaStream);

      expect(firstPeerConnection.close).toHaveBeenCalled();
    });
  });

      describe('closeConnection()', () => {
        let mockOffer: RTCSessionDescriptionInit;
        let mockAnswer: RTCSessionDescription;
  
        beforeEach(async () => {
          mockOffer = { type: 'offer', sdp: 'mock-sdp-offer' };
          mockAnswer = new RTCSessionDescription({ type: 'answer', sdp: 'mock-sdp-answer' });
  
          vi.mocked(mockPeerConnectionInstance.createOffer).mockResolvedValue(mockOffer);
          vi.spyOn(mockPeerConnectionInstance, 'setLocalDescription').mockImplementation((sdp) => {
            mockPeerConnectionInstance.localDescription = sdp;
            return Promise.resolve();
          });
          vi.spyOn(mockPeerConnectionInstance, 'setRemoteDescription').mockImplementation((sdp) => {
            mockPeerConnectionInstance.remoteDescription = sdp;
            return Promise.resolve();
          });
          vi.mocked(mockPeerConnectionInstance.getTransceivers).mockReturnValue([]);
          vi.mocked(mockPeerConnectionInstance.getStats).mockResolvedValue(new Map());
  
          window.fetch = vi.fn().mockImplementation(() => 
            Promise.resolve(new Response('mock-sdp-answer', { status: 201 }))
          );
  
          vi.spyOn(helpers, 'waitForICEGatheringComplete').mockResolvedValue(undefined);
          vi.spyOn(helpers, 'waitForConnection').mockResolvedValue(undefined);
  
          await simulateSuccessfulConnection(mockPeerConnectionInstance, mockOffer, service, mockMediaStream);
        });
    it('should close peer connection', () => {
      service.closeConnection();
      expect(mockPeerConnectionInstance.close).toHaveBeenCalled();
    });

    it('should set connectionState to "closed"', () => {
      service.closeConnection();
      expect(service.connectionState()).toBe('closed');
    });

    it('should clear current stream', () => {
      service.closeConnection();
      expect(service.currentStream()).toBeNull();
    });

    it('should clear metrics', () => {
      service.closeConnection();
      expect(service.metrics()).toBeNull();
    });

    it('should handle closing when no connection exists', () => {
      service.closeConnection();
      expect(() => service.closeConnection()).not.toThrow();
      expect(service.connectionState()).toBe('closed');
    });
  });

  describe('connection state management', () => {
    let mockOffer: RTCSessionDescriptionInit;
    let mockAnswer: RTCSessionDescription;

    beforeEach(async () => {
      mockOffer = { type: 'offer', sdp: 'mock-sdp-offer' };
      mockAnswer = new RTCSessionDescription({ type: 'answer', sdp: 'mock-sdp-answer' });

      vi.mocked(mockPeerConnectionInstance.createOffer).mockResolvedValue(mockOffer);
      vi.spyOn(mockPeerConnectionInstance, 'setLocalDescription').mockImplementation((sdp) => {
        mockPeerConnectionInstance.localDescription = sdp;
        return Promise.resolve();
      });
      vi.spyOn(mockPeerConnectionInstance, 'setRemoteDescription').mockImplementation((sdp) => {
        mockPeerConnectionInstance.remoteDescription = sdp;
        return Promise.resolve();
      });
      vi.mocked(mockPeerConnectionInstance.getTransceivers).mockReturnValue([]);
      vi.mocked(mockPeerConnectionInstance.getStats).mockResolvedValue(new Map());

      window.fetch = vi.fn().mockImplementation(() => 
        Promise.resolve(new Response('mock-sdp-answer', { status: 201 }))
      );

      vi.spyOn(helpers, 'waitForICEGatheringComplete').mockResolvedValue(undefined);
      vi.spyOn(helpers, 'waitForConnection').mockResolvedValue(undefined);

      await simulateSuccessfulConnection(mockPeerConnectionInstance, mockOffer, service, mockMediaStream);
    });

    it('should update state to "disconnected" when connection drops', () => {
      // Simulate disconnection
      Object.defineProperty(mockPeerConnectionInstance, 'connectionState', { value: 'disconnected', configurable: true });

      // Get the onconnectionstatechange handler
      if (mockPeerConnectionInstance.onconnectionstatechange) {
        mockPeerConnectionInstance.onconnectionstatechange(new Event('connectionstatechange'));
      }

      expect(service.connectionState()).toBe('disconnected');
    });

    it('should update state to "failed" when connection fails', () => {
      // Simulate failure
      Object.defineProperty(mockPeerConnectionInstance, 'connectionState', { value: 'failed', configurable: true });

      // Get the onconnectionstatechange handler
      if (mockPeerConnectionInstance.onconnectionstatechange) {
        mockPeerConnectionInstance.onconnectionstatechange(new Event('connectionstatechange'));
      }

      expect(service.connectionState()).toBe('failed');
      expect(service.hasError()).toBe(true);
    });
  });

  describe('computed signals', () => {
    it('should compute isConnected correctly', () => {
      expect(service.isConnected()).toBe(false);

      service['_connectionState'].set('connected');
      expect(service.isConnected()).toBe(true);

      service['_connectionState'].set('disconnected');
      expect(service.isConnected()).toBe(false);
    });

    it('should compute isConnecting correctly', () => {
      expect(service.isConnecting()).toBe(false);

      service['_connectionState'].set('connecting');
      expect(service.isConnecting()).toBe(true);

      service['_connectionState'].set('connected');
      expect(service.isConnecting()).toBe(false);
    });

    it('should compute hasError correctly', () => {
      expect(service.hasError()).toBe(false);

      service['_error'].set(new Error('Test error'));
      expect(service.hasError()).toBe(true);

      service['_error'].set(null);
      expect(service.hasError()).toBe(false);
    });
  });
});
