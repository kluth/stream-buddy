import type { WebRTCGatewayConfig } from './webrtc-gateway.service';

export async function negotiateWithWHIP(
  offer: RTCSessionDescriptionInit,
  whipUrl: string
): Promise<RTCSessionDescription> {
  // 1. Send SDP offer to WHIP endpoint
  const response = await fetch(whipUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/sdp'
    },
    body: offer.sdp
  });

  // 2. Check response status
  if (!response.ok) {
    throw new Error(
      `WHIP negotiation failed: ${response.status} ${response.statusText}`
    );
  }

  // 3. Parse SDP answer
  const answerSDP = await response.text();

  // 4. Create RTCSessionDescription
  return new RTCSessionDescription({
    type: 'answer',
    sdp: answerSDP
  });
}

export function forceCodecPreferences(
  pc: RTCPeerConnection,
  preferences: readonly string[]
): void {
  const transceivers = pc.getTransceivers();

  transceivers.forEach(transceiver => {
    const kind = transceiver.sender.track?.kind;

    if (!kind) return;

    // Get supported codecs
    const capabilities = RTCRtpSender.getCapabilities(kind);
    if (!capabilities) return;

    // Filter codecs based on preferences
    const preferredCodecs = capabilities.codecs.filter(codec => {
      return preferences.some(preference =>
        codec.mimeType.toLowerCase().includes(preference.toLowerCase())
      );
    });

    // Set codec preferences
    if (preferredCodecs.length > 0) {
      transceiver.setCodecPreferences(preferredCodecs);
    }
  });
}

export async function waitForICEGatheringComplete(
  pc: RTCPeerConnection,
  timeout: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }

    const timeoutId = setTimeout(() => {
      reject(new Error('ICE gathering timeout'));
    }, timeout);

    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timeoutId);
        resolve();
      }
    }, { once: true });
  });
}

export async function waitForConnection(
  pc: RTCPeerConnection,
  timeout: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (pc.connectionState === 'connected') {
      resolve();
      return;
    }

    const timeoutId = setTimeout(() => {
      reject(new Error(`Connection timeout after ${timeout}ms`));
    }, timeout);

    const checkState = () => {
      if (pc.connectionState === 'connected') {
        clearTimeout(timeoutId);
        pc.removeEventListener('connectionstatechange', checkState);
        resolve();
      } else if (pc.connectionState === 'failed') {
        clearTimeout(timeoutId);
        pc.removeEventListener('connectionstatechange', checkState);
        reject(new Error('Connection failed'));
      }
    };

    pc.addEventListener('connectionstatechange', checkState);
  });
}
