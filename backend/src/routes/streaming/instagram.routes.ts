import { Router } from 'express';
import axios from 'axios';
import * as Sentry from '@sentry/node'; // Import Sentry

const router = Router();

// MediaMTX API URL
const MEDIAMTX_API_URL = 'http://localhost:9997/v3/config/paths/add';

router.post('/instagram/configure', async (req, res) => {
  const transaction = Sentry.startTransaction({
    op: "instagram.configure",
    name: "Configure Instagram Streaming",
  });

  try {
    const { rtmpUrl, streamKey } = req.body;
    transaction.setData("rtmpUrl", rtmpUrl);

    if (!rtmpUrl || !streamKey) {
      transaction.setStatus("invalid_argument");
      return res.status(400).json({ message: 'RTMP URL and Stream Key are required' });
    }

    // Sanitize streamKey to prevent command injection
    // Allow alphanumeric characters, hyphens, and underscores, which are typical in stream keys.
    const safeStreamKey = streamKey.replace(/[^a-zA-Z0-9_-]/g, ''); 
    if (safeStreamKey !== streamKey) {
        transaction.setStatus("invalid_argument");
        return res.status(400).json({ message: 'Stream Key contains unsafe characters.' });
    }

    // Validate Instagram RTMP URL
    if (!rtmpUrl.includes('instagram.com')) {
      transaction.setStatus("invalid_argument");
      return res.status(400).json({ message: 'Invalid Instagram RTMP URL' });
    }

    // Construct full RTMP destination
    const destination = `${rtmpUrl}${streamKey}`;

    const pathName = 'instagram';
    const config = {
      source: 'publisher',
      runOnPublish: `ffmpeg -i rtsp://localhost:$RTSP_PORT/$MTX_PATH -c copy -f flv "${destination}"`,
      runOnPublishRestart: true,
    };

    // Add span for MediaMTX configuration
    const mediamtxSpan = transaction.startChild({
      op: "mediamtx.config",
      description: "Configure MediaMTX path for Instagram",
    });

    try {
      await axios.post(`${MEDIAMTX_API_URL}/${pathName}`, config);
      mediamtxSpan.setStatus("ok");
    } catch (mediamtxError: any) {
      mediamtxSpan.setStatus("internal_error");
      Sentry.captureException(mediamtxError);
      throw new Error(`MediaMTX configuration failed: ${mediamtxError.message}`);
    } finally {
      mediamtxSpan.finish();
    }

    transaction.setStatus("ok");
    res.json({ message: 'Instagram streaming configured successfully', path: pathName });
  } catch (error: any) {
    transaction.setStatus("internal_error");
    Sentry.captureException(error);
    console.error('Error configuring Instagram stream:', error.message);
    res.status(500).json({ message: 'Failed to configure streaming server', error: error.message });
  } finally {
    transaction.finish();
  }
});

export const instagramRoutes = router;
