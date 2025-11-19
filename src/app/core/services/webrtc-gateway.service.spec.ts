import { TestBed } from '@angular/core/testing';
import { WebRTCGatewayService, type WebRTCGatewayConfig, type ConnectionMetrics } from './webrtc-gateway.service';
import { WEBRTC_GATEWAY_CONFIG } from './webrtc-gateway.config';
import type { ConnectionState } from '../models/webrtc-gateway.types';
import * as helpers from './webrtc-gateway.helpers';

async function simulateSuccessfulConnection(
  peerConnection: jasmine.SpyObj<RTCPeerConnection>,
  offer: RTCSessionDescriptionInit,
  gatewayService: WebRTCGatewayService,
  stream: MediaStream
) {
  // Simulate ICE gathering complete
  Object.defineProperty(peerConnection, 'iceGatheringState', { value: 'complete', configurable: true });
  Object.defineProperty(peerConnection, 'localDescription', { value: offer, configurable: true });

  const iceGatheringHandler = (peerConnection.addEventListener as jasmine.Spy).calls
    .all()
    .find(call => call.args[0] === 'icegatheringstatechange')?.args[1];
  if (iceGatheringHandler) {
    iceGatheringHandler();
  }

  // Simulate connection
  Object.defineProperty(peerConnection, 'connectionState', { value: 'connected', configurable: true });
  const connectionHandler = (peerConnection.addEventListener as jasmine.Spy).calls
    .all()
    .find(call => call.args[0] === 'connectionstatechange')?.args[1];
  if (connectionHandler) {
    connectionHandler();
  }

  // Wait for the connection to be established
  await gatewayService.createConnection(stream);
}

describe('WebRTCGatewayService', () => {
  let service: WebRTCGatewayService;
  let mockPeerConnection: jasmine.SpyObj<RTCPeerConnection>;
  let mockMediaStream: jasmine.SpyObj<MediaStream>;
  let originalRTCPeerConnection: typeof RTCPeerConnection;
  let originalFetch: typeof fetch;
  let forceCodecPreferencesSpy: jasmine.Spy;

  const mockConfig: WebRTCGatewayConfig = {
    whipUrl: 'http://localhost:8889/live/whip',
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    codecPreferences: ['video/H264', 'audio/opus'],
    connectionTimeout: 10000
  };

  beforeEach(() => {
    // Save original globals
    originalRTCPeerConnection = window.RTCPeerConnection;
    originalFetch = window.fetch;

    // Create mock MediaStream
    mockMediaStream = jasmine.createSpyObj<MediaStream>('MediaStream', ['getTracks', 'getAudioTracks', 'getVideoTracks']);
    const mockVideoTrack = jasmine.createSpyObj<MediaStreamTrack>('MediaStreamTrack', ['stop']);
    mockVideoTrack.kind = 'video';
    const mockAudioTrack = jasmine.createSpyObj<MediaStreamTrack>('MediaStreamTrack', ['stop']);
    mockAudioTrack.kind = 'audio';
    mockMediaStream.getTracks.and.returnValue([mockVideoTrack, mockAudioTrack]);

    // Create mock RTCPeerConnection
    mockPeerConnection = jasmine.createSpyObj<RTCPeerConnection>(
      'RTCPeerConnection',
      [
        'addTrack',
        'createOffer',
        'setLocalDescription',
        'setRemoteDescription',
        'close',
        'getTransceivers',
        'getStats',
        'addEventListener',
        'removeEventListener'
      ],
      {
        connectionState: 'new',
        iceGatheringState: 'new',
        iceConnectionState: 'new',
        localDescription: null,
        onicecandidate: null,
        onconnectionstatechange: null,
        onicegatheringstatechange: null,
        oniceconnectionstatechange: null
      }
    );

    // Mock RTCPeerConnection constructor
    (window as any).RTCPeerConnection = jasmine.createSpy('RTCPeerConnection').and.returnValue(mockPeerConnection);

    // Mock RTCRtpSender.getCapabilities
    spyOn(RTCRtpSender, 'getCapabilities').and.returnValue({
      codecs: [
        {
          mimeType: 'video/H264',
          clockRate: 90000,
          sdpFmtpLine: 'profile-level-id=42e01f'
        },
        {
          mimeType: 'audio/opus',
          clockRate: 48000
        }
      ],
      headerExtensions: []
    });

    // Spy on helper functions
    forceCodecPreferencesSpy = spyOn(helpers, 'forceCodecPreferences').and.callThrough();

    TestBed.configureTestingModule({
      providers: [
        WebRTCGatewayService,
        { provide: WEBRTC_GATEWAY_CONFIG, useValue: mockConfig }
      ]
    });

    service = TestBed.inject(WebRTCGatewayService);
  });

  afterEach(() => {
    // Restore original globals
    window.RTCPeerConnection = originalRTCPeerConnection;
    window.fetch = originalFetch;
    service.closeConnection();
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

      mockPeerConnection.createOffer.and.returnValue(Promise.resolve(mockOffer));
      mockPeerConnection.setLocalDescription.and.returnValue(Promise.resolve());
      mockPeerConnection.setRemoteDescription.and.returnValue(Promise.resolve());
      mockPeerConnection.getTransceivers.and.returnValue([]);
      mockPeerConnection.getStats.and.returnValue(Promise.resolve(new Map()));

      // Mock fetch for WHIP negotiation
      window.fetch = jasmine.createSpy('fetch').and.returnValue(
        Promise.resolve(new Response('mock-sdp-answer', { status: 201 }))
      );
    });

    it('should call forceCodecPreferences with correct preferences', async () => {
      await simulateSuccessfulConnection(mockPeerConnection, mockOffer, service, mockMediaStream);
      expect(forceCodecPreferencesSpy).toHaveBeenCalledWith(jasmine.any(RTCPeerConnection), mockConfig.codecPreferences);
    });

    it('should set connectionState to "connecting" when starting', async () => {
      const connectionPromise = service.createConnection(mockMediaStream);
      expect(service.connectionState()).toBe('connecting');
      expect(service.isConnecting()).toBe(true);
      await simulateSuccessfulConnection(mockPeerConnection, mockOffer, service, mockMediaStream);
      await connectionPromise;
    });

    it('should store the current stream', async () => {
      await simulateSuccessfulConnection(mockPeerConnection, mockOffer, service, mockMediaStream);
      expect(service.currentStream()).toBe(mockMediaStream);
    });

    it('should create RTCPeerConnection with default ICE servers', async () => {
      await simulateSuccessfulConnection(mockPeerConnection, mockOffer, service, mockMediaStream);
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

      await simulateSuccessfulConnection(mockPeerConnection, mockOffer, service, mockMediaStream);
      await connectionPromise;
    });

    it('should add all tracks from stream to peer connection', async () => {
      await simulateSuccessfulConnection(mockPeerConnection, mockOffer, service, mockMediaStream);
      expect(mockPeerConnection.addTrack).toHaveBeenCalledTimes(2);
    });

    it('should create SDP offer with correct options', async () => {
      await simulateSuccessfulConnection(mockPeerConnection, mockOffer, service, mockMediaStream);
      expect(mockPeerConnection.createOffer).toHaveBeenCalledWith({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
    });

    it('should set local description', async () => {
      await simulateSuccessfulConnection(mockPeerConnection, mockOffer, service, mockMediaStream);
      expect(mockPeerConnection.setLocalDescription).toHaveBeenCalledWith(mockOffer);
    });

    it('should negotiate with WHIP endpoint using default URL', async () => {
      await simulateSuccessfulConnection(mockPeerConnection, mockOffer, service, mockMediaStream);
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
      await simulateSuccessfulConnection(mockPeerConnection, mockOffer, service, mockMediaStream);
      await connectionPromise;

      expect(window.fetch).toHaveBeenCalledWith(
        'https://custom.example.com/whip',
        jasmine.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' }
        })
      );
    });

    it('should set remote description with WHIP answer', async () => {
      await simulateSuccessfulConnection(mockPeerConnection, mockOffer, service, mockMediaStream);
      expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalledWith(
        jasmine.objectContaining({
          type: 'answer',
          sdp: 'mock-sdp-answer'
        })
      );
    });

    it('should set connectionState to "connected" on success', async () => {
      await simulateSuccessfulConnection(mockPeerConnection, mockOffer, service, mockMediaStream);
      expect(service.connectionState()).toBe('connected');
      expect(service.isConnected()).toBe(true);
    });

    it('should handle WHIP negotiation failure', async () => {
      window.fetch = jasmine.createSpy('fetch').and.returnValue(
        Promise.resolve(new Response('Not Found', { status: 404, statusText: 'Not Found' }))
      );

      // Simulate ICE gathering complete
      Object.defineProperty(mockPeerConnection, 'iceGatheringState', { value: 'complete', configurable: true });
      Object.defineProperty(mockPeerConnection, 'localDescription', { value: mockOffer, configurable: true });

      const iceGatheringHandler = (mockPeerConnection.addEventListener as jasmine.Spy).calls
        .all()
        .find(call => call.args[0] === 'icegatheringstatechange')?.args[1];

      const connectionPromise = service.createConnection(mockMediaStream);

      if (iceGatheringHandler) {
        iceGatheringHandler();
      }

      await expectAsync(connectionPromise).toBeRejectedWithError(/WHIP negotiation failed: 404/);
      expect(service.connectionState()).toBe('failed');
      expect(service.hasError()).toBe(true);
    });

    it('should handle connection timeout', async () => {
      const customConfig: Partial<WebRTCGatewayConfig> = {
        connectionTimeout: 100 // Short timeout for testing
      };

      // Simulate ICE gathering complete
      Object.defineProperty(mockPeerConnection, 'iceGatheringState', { value: 'complete', configurable: true });
      Object.defineProperty(mockPeerConnection, 'localDescription', { value: mockOffer, configurable: true });

      const iceGatheringHandler = (mockPeerConnection.addEventListener as jasmine.Spy).calls
        .all()
        .find(call => call.args[0] === 'icegatheringstatechange')?.args[1];

      const connectionPromise = service.createConnection(mockMediaStream, customConfig);

      if (iceGatheringHandler) {
        iceGatheringHandler();
      }

      // Don't simulate connection - let it timeout
      await expectAsync(connectionPromise).toBeRejectedWithError(/Connection timeout/);
      expect(service.connectionState()).toBe('failed');
      expect(service.hasError()).toBe(true);
    });

    it('should close existing connection before creating new one', async () => {
      // First connection
      await simulateSuccessfulConnection(mockPeerConnection, mockOffer, service, mockMediaStream);
      const firstPeerConnection = mockPeerConnection;

      // Reset mocks for second connection
      mockPeerConnection = jasmine.createSpyObj<RTCPeerConnection>(
        'RTCPeerConnection',
        [
          'addTrack',
          'createOffer',
          'setLocalDescription',
          'setRemoteDescription',
          'close',
          'getTransceivers',
          'getStats',
          'addEventListener',
          'removeEventListener'
        ],
        {
          connectionState: 'new',
          iceGatheringState: 'new',
          iceConnectionState: 'new',
          localDescription: null,
          onicecandidate: null,
          onconnectionstatechange: null,
          onicegatheringstatechange: null,
          oniceconnectionstatechange: null
        }
      );
      (window as any).RTCPeerConnection = jasmine.createSpy('RTCPeerConnection').and.returnValue(mockPeerConnection);
      mockPeerConnection.createOffer.and.returnValue(Promise.resolve(mockOffer));
      mockPeerConnection.setLocalDescription.and.returnValue(Promise.resolve());
      mockPeerConnection.setRemoteDescription.and.returnValue(Promise.resolve());
      mockPeerConnection.getTransceivers.and.returnValue([]);
      mockPeerConnection.getStats.and.returnValue(Promise.resolve(new Map()));

      // Second connection
      await simulateSuccessfulConnection(mockPeerConnection, mockOffer, service, mockMediaStream);

      expect(firstPeerConnection.close).toHaveBeenCalled();
    });
  });

  describe('closeConnection()', () => {
    beforeEach(async () => {
      mockPeerConnection.createOffer.and.returnValue(
        Promise.resolve({ type: 'offer', sdp: 'mock-sdp-offer' })
      );
      mockPeerConnection.setLocalDescription.and.returnValue(Promise.resolve());
      mockPeerConnection.setRemoteDescription.and.returnValue(Promise.resolve());
      mockPeerConnection.getTransceivers.and.returnValue([]);
      mockPeerConnection.getStats.and.returnValue(Promise.resolve(new Map()));

      window.fetch = jasmine.createSpy('fetch').and.returnValue(
        Promise.resolve(new Response('mock-sdp-answer', { status: 201 }))
      );

      await simulateSuccessfulConnection(mockPeerConnection, { type: 'offer', sdp: 'mock-sdp-offer' }, service, mockMediaStream);
    });

    it('should close peer connection', () => {
      service.closeConnection();
      expect(mockPeerConnection.close).toHaveBeenCalled();
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
    beforeEach(async () => {
      mockPeerConnection.createOffer.and.returnValue(
        Promise.resolve({ type: 'offer', sdp: 'mock-sdp-offer' })
      );
      mockPeerConnection.setLocalDescription.and.returnValue(Promise.resolve());
      mockPeerConnection.setRemoteDescription.and.returnValue(Promise.resolve());
      mockPeerConnection.getTransceivers.and.returnValue([]);
      mockPeerConnection.getStats.and.returnValue(Promise.resolve(new Map()));

      window.fetch = jasmine.createSpy('fetch').and.returnValue(
        Promise.resolve(new Response('mock-sdp-answer', { status: 201 }))
      );

      await simulateSuccessfulConnection(mockPeerConnection, { type: 'offer', sdp: 'mock-sdp-offer' }, service, mockMediaStream);
    });

    it('should update state to "disconnected" when connection drops', () => {
      // Simulate disconnection
      Object.defineProperty(mockPeerConnection, 'connectionState', { value: 'disconnected', configurable: true });

      // Get the onconnectionstatechange handler
      if (mockPeerConnection.onconnectionstatechange) {
        mockPeerConnection.onconnectionstatechange(new Event('connectionstatechange'));
      }

      expect(service.connectionState()).toBe('disconnected');
    });

    it('should update state to "failed" when connection fails', () => {
      // Simulate failure
      Object.defineProperty(mockPeerConnection, 'connectionState', { value: 'failed', configurable: true });

      // Get the onconnectionstatechange handler
      if (mockPeerConnection.onconnectionstatechange) {
        mockPeerConnection.onconnectionstatechange(new Event('connectionstatechange'));
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