import { TestBed } from '@angular/core/testing';
import { AudioMixerService } from './audio-mixer.service';
import { provideZonelessChangeDetection } from '@angular/core';

describe('AudioMixerService', () => {
  let service: AudioMixerService;

  // Mock Web Audio API
  const mockGainNode = {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockSourceNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockAnalyserNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    getFloatTimeDomainData: vi.fn((array: Float32Array) => {
        // Fill with some dummy data for RMS calc
        for(let i=0; i<array.length; i++) {
            array[i] = 0.1; // constant level
        }
    }),
  };

  const mockDestinationNode = {
    stream: {} as MediaStream,
  };

  const mockAudioContext = {
    state: 'suspended',
    resume: vi.fn().mockResolvedValue(undefined),
    createMediaStreamDestination: vi.fn().mockReturnValue(mockDestinationNode),
    createMediaStreamSource: vi.fn().mockReturnValue(mockSourceNode),
    createGain: vi.fn().mockReturnValue(mockGainNode),
    createAnalyser: vi.fn().mockReturnValue(mockAnalyserNode),
    close: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    // Mock global AudioContext
    (global as any).AudioContext = vi.fn(function() {
      return mockAudioContext;
    });
    
    // Mock requestAnimationFrame to execute callback immediately once (or control it)
    (global as any).requestAnimationFrame = vi.fn((cb) => {
        // Don't loop infinitely in tests, just don't call back or call once if needed
        return 123; 
    });
    (global as any).cancelAnimationFrame = vi.fn();

    TestBed.configureTestingModule({
        providers: [provideZonelessChangeDetection()]
    });
    service = TestBed.inject(AudioMixerService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize AudioContext', async () => {
    await service.initialize();
    expect(global.AudioContext).toHaveBeenCalled();
    expect(service.mixedOutputStream()).toBe(mockDestinationNode.stream);
  });

  it('should add audio source with analyser', async () => {
    const mockStream = { id: 'stream-1' } as MediaStream;
    await service.initialize();
    
    const id = await service.addAudioSource(mockStream);
    
    expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
    expect(mockSourceNode.connect).toHaveBeenCalledWith(mockGainNode);
    expect(mockGainNode.connect).toHaveBeenCalledWith(mockAnalyserNode);
    expect(mockAnalyserNode.connect).toHaveBeenCalledWith(mockDestinationNode);
    expect(id).toBeDefined();
  });

  it('should set volume', async () => {
    const mockStream = { id: 'stream-1' } as MediaStream;
    await service.initialize();
    const id = await service.addAudioSource(mockStream);

    service.setSourceVolume(id, 0.5);
    expect(mockGainNode.gain.value).toBe(0.5);
  });

  it('should remove source', async () => {
    const mockStream = { id: 'stream-1' } as MediaStream;
    await service.initialize();
    const id = await service.addAudioSource(mockStream);

    service.removeAudioSource(id);
    
    expect(mockSourceNode.disconnect).toHaveBeenCalled();
    expect(mockGainNode.disconnect).toHaveBeenCalled();
    expect(mockAnalyserNode.disconnect).toHaveBeenCalled();
  });

  it('should update audio levels', async () => {
    const mockStream = { id: 'stream-1' } as MediaStream;
    await service.initialize();
    await service.addAudioSource(mockStream);

    // Manually trigger the update loop logic (private method access via any)
    (service as any).updateAudioLevels();

    const levels = service.audioLevels();
    expect(levels.length).toBe(1);
    expect(levels[0].level).toBeGreaterThan(0);
    expect(mockAnalyserNode.getFloatTimeDomainData).toHaveBeenCalled();
  });
});