import { TestBed } from '@angular/core/testing';
import { AudioDSPService, AudioEffect, EffectChain, EffectPreset } from './audio-dsp.service';
import { provideZonelessChangeDetection } from '@angular/core';

describe('AudioDSPService', () => {
  let service: AudioDSPService;

  // Mock Web Audio API nodes
  const mockGainNode = {
    gain: { value: 1, setValueAtTime: vi.fn() },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  };

  const mockBiquadFilterNode = {
    type: 'lowpass',
    frequency: { value: 1000, setValueAtTime: vi.fn() },
    Q: { value: 1, setValueAtTime: vi.fn() },
    gain: { value: 0, setValueAtTime: vi.fn() },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  };

  const mockDynamicsCompressorNode = {
    threshold: { value: -24, setValueAtTime: vi.fn() },
    ratio: { value: 1, setValueAtTime: vi.fn() },
    attack: { value: 0.003, setValueAtTime: vi.fn() },
    release: { value: 0.25, setValueAtTime: vi.fn() },
    knee: { value: 30, setValueAtTime: vi.fn() },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  };

  const mockDelayNode = {
    delayTime: { value: 0.5, setValueAtTime: vi.fn() },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  };

  const mockAnalyserNode = {
    fftSize: 2048,
    frequencyBinCount: 1024,
    smoothingTimeConstant: 0.8,
    getFloatFrequencyData: vi.fn((array: Float32Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = -80 + Math.random() * 60; // Random frequency data
      }
    }),
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  };

  const mockSourceNode = {
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  };

  const mockDestinationNode = {
    stream: { getTracks: vi.fn(() => []) } as unknown as MediaStream,
  };

  const mockAudioContext = {
    sampleRate: 44100,
    state: 'running',
    resume: vi.fn().mockResolvedValue(undefined),
    createMediaStreamSource: vi.fn().mockReturnValue(mockSourceNode),
    createMediaStreamDestination: vi.fn().mockReturnValue(mockDestinationNode),
    createGain: vi.fn().mockReturnValue(mockGainNode),
    createBiquadFilter: vi.fn().mockReturnValue(mockBiquadFilterNode),
    createDynamicsCompressor: vi.fn().mockReturnValue(mockDynamicsCompressorNode),
    createDelay: vi.fn().mockReturnValue(mockDelayNode),
    createAnalyser: vi.fn().mockReturnValue(mockAnalyserNode),
    close: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    // Mock Web Audio API
    (global as any).AudioContext = vi.fn(() => mockAudioContext);

    // Mock requestAnimationFrame
    (global as any).requestAnimationFrame = vi.fn((cb) => 123);
    (global as any).cancelAnimationFrame = vi.fn();

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    (global as any).localStorage = localStorageMock;

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });

    service = TestBed.inject(AudioDSPService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    service.destroy();
  });

  // ============================================================================
  // Service Creation
  // ============================================================================

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with empty chains', () => {
    expect(service.chains().length).toBe(0);
  });

  it('should initialize with default presets', () => {
    expect(service.presets().length).toBeGreaterThan(0);
  });

  // ============================================================================
  // Chain Management
  // ============================================================================

  describe('Chain Management', () => {
    it('should create a new chain', () => {
      const chainId = service.createChain({ name: 'Test Chain' });

      expect(chainId).toBeDefined();
      expect(service.chains().length).toBe(1);
      expect(service.chains()[0].name).toBe('Test Chain');
    });

    it('should create chain with default values', () => {
      const chainId = service.createChain({});

      const chain = service.chains()[0];
      expect(chain.enabled).toBe(true);
      expect(chain.effects).toEqual([]);
      expect(chain.inputGain).toBe(0);
      expect(chain.outputGain).toBe(0);
    });

    it('should update a chain', () => {
      const chainId = service.createChain({ name: 'Original' });
      service.updateChain(chainId, { name: 'Updated' });

      expect(service.chains()[0].name).toBe('Updated');
      expect(service.chains()[0].lastModified).toBeDefined();
    });

    it('should delete a chain', () => {
      const chainId = service.createChain({ name: 'To Delete' });
      service.deleteChain(chainId);

      expect(service.chains().length).toBe(0);
    });

    it('should clear active chain when deleted', () => {
      const chainId = service.createChain({ name: 'Active' });
      service.setActiveChain(chainId);

      expect(service.activeChainId()).toBe(chainId);

      service.deleteChain(chainId);

      expect(service.activeChainId()).toBeNull();
    });

    it('should set active chain', () => {
      const chainId = service.createChain({ name: 'Active' });
      service.setActiveChain(chainId);

      expect(service.activeChainId()).toBe(chainId);
    });

    it('should compute active chain signal', () => {
      const chainId = service.createChain({ name: 'Active' });
      service.setActiveChain(chainId);

      expect(service.activeChain()).toBeDefined();
      expect(service.activeChain()?.id).toBe(chainId);
    });

    it('should emit chainUpdated event', () => {
      let emittedChain: EffectChain | undefined;
      service.chainUpdated$.subscribe((chain) => {
        emittedChain = chain;
      });

      const chainId = service.createChain({ name: 'Test' });
      service.updateChain(chainId, { name: 'Updated' });

      expect(emittedChain).toBeDefined();
      expect(emittedChain?.name).toBe('Updated');
    });
  });

  // ============================================================================
  // Effect Management
  // ============================================================================

  describe('Effect Management', () => {
    let chainId: string;

    beforeEach(() => {
      chainId = service.createChain({ name: 'Test Chain' });
    });

    it('should add effect to chain', () => {
      const effectId = service.addEffect(chainId, {
        name: 'Test Effect',
        type: 'eq-parametric',
      });

      expect(effectId).toBeDefined();
      expect(service.chains()[0].effects.length).toBe(1);
      expect(service.chains()[0].effects[0].type).toBe('eq-parametric');
    });

    it('should create effect with default values', () => {
      const effectId = service.addEffect(chainId, {});

      const effect = service.chains()[0].effects[0];
      expect(effect.enabled).toBe(true);
      expect(effect.bypass).toBe(false);
      expect(effect.wetDry).toBe(100);
      expect(effect.gain).toBe(0);
    });

    it('should throw error when adding effect to non-existent chain', () => {
      expect(() => {
        service.addEffect('non-existent', { name: 'Effect' });
      }).toThrow('Chain not found');
    });

    it('should update effect', () => {
      const effectId = service.addEffect(chainId, {
        name: 'Original',
        type: 'compressor',
      });

      service.updateEffect(chainId, effectId, { name: 'Updated', enabled: false });

      const effect = service.chains()[0].effects[0];
      expect(effect.name).toBe('Updated');
      expect(effect.enabled).toBe(false);
    });

    it('should remove effect from chain', () => {
      const effectId = service.addEffect(chainId, { name: 'Effect' });

      service.removeEffect(chainId, effectId);

      expect(service.chains()[0].effects.length).toBe(0);
    });

    it('should emit effectAdded event', () => {
      let emittedEffect: AudioEffect | undefined;
      service.effectAdded$.subscribe((data) => {
        emittedEffect = data.effect;
      });

      service.addEffect(chainId, { name: 'Test Effect' });

      expect(emittedEffect).toBeDefined();
      expect(emittedEffect?.name).toBe('Test Effect');
    });

    it('should emit effectRemoved event', () => {
      const effectId = service.addEffect(chainId, { name: 'Effect' });

      let emittedData: { chainId: string; effectId: string } | undefined;
      service.effectRemoved$.subscribe((data) => {
        emittedData = data;
      });

      service.removeEffect(chainId, effectId);

      expect(emittedData).toBeDefined();
      expect(emittedData?.effectId).toBe(effectId);
    });

    it('should reorder effects in chain', () => {
      const id1 = service.addEffect(chainId, { name: 'Effect 1' });
      const id2 = service.addEffect(chainId, { name: 'Effect 2' });
      const id3 = service.addEffect(chainId, { name: 'Effect 3' });

      service.reorderEffect(chainId, id3, 0);

      const effects = service.chains()[0].effects;
      expect(effects[0].id).toBe(id3);
      expect(effects[0].order).toBe(0);
      expect(effects[1].order).toBe(1);
    });

    it('should compute enabled effects', () => {
      service.setActiveChain(chainId);

      service.addEffect(chainId, { name: 'Enabled', type: 'eq-parametric', enabled: true });
      service.addEffect(chainId, { name: 'Disabled', type: 'compressor', enabled: false });
      service.addEffect(chainId, { name: 'Bypassed', type: 'delay', bypass: true });

      expect(service.enabledEffects().length).toBe(1);
      expect(service.enabledEffects()[0].name).toBe('Enabled');
    });
  });

  // ============================================================================
  // Effect Creation - EQ, Compressor, Filter, Delay
  // ============================================================================

  describe('Effect Creation - Audio Nodes', () => {
    let chainId: string;

    beforeEach(() => {
      chainId = service.createChain({ name: 'Test Chain' });
    });

    it('should create parametric EQ with bands', () => {
      const effectId = service.addEffect(chainId, {
        name: 'Parametric EQ',
        type: 'eq-parametric',
        params: {
          bands: [
            { id: 'b1', frequency: 100, gain: 3, q: 1, type: 'lowshelf', enabled: true },
            { id: 'b2', frequency: 1000, gain: -2, q: 1.5, type: 'peaking', enabled: true },
          ],
        },
      });

      const effect = service.chains()[0].effects[0];
      expect(effect.params.bands).toBeDefined();
      expect(effect.params.bands?.length).toBe(2);
    });

    it('should create compressor with dynamics parameters', () => {
      const effectId = service.addEffect(chainId, {
        name: 'Compressor',
        type: 'compressor',
        params: {
          threshold: -20,
          ratio: 4,
          attack: 10,
          release: 100,
          knee: 3,
          makeup: 6,
        },
      });

      const effect = service.chains()[0].effects[0];
      expect(effect.params.threshold).toBe(-20);
      expect(effect.params.ratio).toBe(4);
      expect(effect.params.attack).toBe(10);
    });

    it('should create filter effects', () => {
      const filterTypes = ['filter-highpass', 'filter-lowpass', 'filter-bandpass', 'filter-notch'];

      filterTypes.forEach((filterType) => {
        const effectId = service.addEffect(chainId, {
          name: `Filter ${filterType}`,
          type: filterType as any,
          params: {
            filterFrequency: 500,
            filterQ: 1.5,
          },
        });

        const effect = service.chains()[0].effects.find((e) => e.name === `Filter ${filterType}`);
        expect(effect).toBeDefined();
      });
    });

    it('should create delay effect with feedback', () => {
      const effectId = service.addEffect(chainId, {
        name: 'Delay',
        type: 'delay',
        params: {
          delayTime: 250,
          delayFeedback: 50,
          delayTaps: 4,
        },
      });

      const effect = service.chains()[0].effects[0];
      expect(effect.params.delayTime).toBe(250);
      expect(effect.params.delayFeedback).toBe(50);
    });

    it('should create reverb effect', () => {
      const effectId = service.addEffect(chainId, {
        name: 'Reverb',
        type: 'reverb',
        params: {
          reverbType: 'hall',
          reverbSize: 75,
          reverbDecay: 2.5,
          reverbDamping: 50,
          reverbPreDelay: 20,
        },
      });

      const effect = service.chains()[0].effects[0];
      expect(effect.params.reverbType).toBe('hall');
      expect(effect.params.reverbDecay).toBe(2.5);
    });

    it('should create de-esser effect', () => {
      const effectId = service.addEffect(chainId, {
        name: 'De-esser',
        type: 'deesser',
        params: {
          deesserFreq: 6000,
          deesserThreshold: -20,
          deesserRatio: 4,
        },
      });

      const effect = service.chains()[0].effects[0];
      expect(effect.params.deesserFreq).toBe(6000);
    });

    it('should set wet/dry mix on effects', () => {
      const effectId = service.addEffect(chainId, {
        name: 'Effect',
        type: 'delay',
        wetDry: 75,
      });

      const effect = service.chains()[0].effects[0];
      expect(effect.wetDry).toBe(75);
    });

    it('should set gain on effects', () => {
      const effectId = service.addEffect(chainId, {
        name: 'Effect',
        type: 'compressor',
        gain: 3,
      });

      const effect = service.chains()[0].effects[0];
      expect(effect.gain).toBe(3);
    });
  });

  // ============================================================================
  // Preset Management
  // ============================================================================

  describe('Preset Management', () => {
    it('should create chain from preset', () => {
      const presets = service.presets();
      expect(presets.length).toBeGreaterThan(0);

      const presetId = presets[0].id;
      const chainId = service.createChainFromPreset(presetId);

      expect(chainId).toBeDefined();
      expect(service.chains().length).toBe(1);
      expect(service.chains()[0].effects.length).toBeGreaterThan(0);
    });

    it('should throw error for non-existent preset', () => {
      expect(() => {
        service.createChainFromPreset('non-existent-preset');
      }).toThrow('Preset not found');
    });

    it('should create custom preset', () => {
      const presetId = service.createCustomPreset({
        name: 'My Custom Preset',
        description: 'A test preset',
        category: 'custom',
        chain: {
          name: 'Custom Chain',
          enabled: true,
          inputGain: 0,
          outputGain: 0,
          inputLevel: 0,
          outputLevel: 0,
          gainReduction: 0,
          effects: [],
        },
      });

      expect(presetId).toBeDefined();
      const preset = service.presets().find((p) => p.id === presetId);
      expect(preset).toBeDefined();
      expect(preset?.name).toBe('My Custom Preset');
    });

    it('should have broadcast preset', () => {
      const broadcastPreset = service.presets().find((p) => p.id === 'voice-broadcast');
      expect(broadcastPreset).toBeDefined();
    });

    it('should have podcast preset', () => {
      const podcastPreset = service.presets().find((p) => p.id === 'podcast-voice');
      expect(podcastPreset).toBeDefined();
    });

    it('should have music mastering preset', () => {
      const musicPreset = service.presets().find((p) => p.id === 'music-master');
      expect(musicPreset).toBeDefined();
    });
  });

  // ============================================================================
  // Export/Import Functionality
  // ============================================================================

  describe('Export/Import', () => {
    let chainId: string;

    beforeEach(() => {
      chainId = service.createChain({ name: 'Export Test' });
      service.addEffect(chainId, {
        name: 'Test Effect',
        type: 'compressor',
        params: { threshold: -20 },
      });
    });

    it('should export chain to JSON', () => {
      const json = service.exportChain(chainId);

      expect(json).toBeDefined();
      expect(typeof json).toBe('string');

      const data = JSON.parse(json);
      expect(data.name).toBe('Export Test');
      expect(data.effects.length).toBe(1);
    });

    it('should throw error exporting non-existent chain', () => {
      expect(() => {
        service.exportChain('non-existent');
      }).toThrow('Chain not found');
    });

    it('should import chain from JSON', () => {
      const json = service.exportChain(chainId);

      const initialCount = service.chains().length;
      const importedId = service.importChain(json);

      expect(service.chains().length).toBe(initialCount + 1);

      const importedChain = service.chains().find((c) => c.id === importedId);
      expect(importedChain?.name).toBe('Export Test');
      expect(importedChain?.effects.length).toBe(1);
    });

    it('should handle invalid JSON import gracefully', () => {
      expect(() => {
        service.importChain('invalid json');
      }).toThrow();
    });

    it('should preserve effect order on export/import', () => {
      const chainId2 = service.createChain({ name: 'Order Test' });
      service.addEffect(chainId2, { name: 'Effect 1', type: 'eq-parametric' });
      service.addEffect(chainId2, { name: 'Effect 2', type: 'compressor' });
      service.addEffect(chainId2, { name: 'Effect 3', type: 'delay' });

      const json = service.exportChain(chainId2);
      const importedId = service.importChain(json);

      const imported = service.chains().find((c) => c.id === importedId);
      expect(imported?.effects[0].name).toBe('Effect 1');
      expect(imported?.effects[1].name).toBe('Effect 2');
      expect(imported?.effects[2].name).toBe('Effect 3');
    });
  });

  // ============================================================================
  // Storage Persistence
  // ============================================================================

  describe('Storage Persistence', () => {
    it('should save to localStorage', () => {
      const chainId = service.createChain({ name: 'Persisted Chain' });

      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('should load from localStorage on initialization', () => {
      const storedData = {
        chains: [
          {
            id: 'chain-1',
            name: 'Loaded Chain',
            enabled: true,
            effects: [],
            inputGain: 0,
            outputGain: 0,
            inputLevel: 0,
            outputLevel: 0,
            gainReduction: 0,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
          },
        ],
        activeChainId: 'chain-1',
        customPresets: [],
      };

      (localStorage.getItem as any).mockReturnValueOnce(JSON.stringify(storedData));

      const newService = TestBed.inject(AudioDSPService);

      expect(localStorage.getItem).toHaveBeenCalledWith('broadboi_audio_dsp');
    });

    it('should handle corrupted localStorage data gracefully', () => {
      (localStorage.getItem as any).mockReturnValueOnce('corrupted data');

      const newService = TestBed.inject(AudioDSPService);

      expect(newService).toBeTruthy();
    });

    it('should persist active chain ID', () => {
      const chainId = service.createChain({ name: 'Active' });
      service.setActiveChain(chainId);

      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('should persist custom presets separately', () => {
      service.createCustomPreset({
        name: 'Custom',
        description: 'Test',
        category: 'custom',
        chain: {
          name: 'Test',
          enabled: true,
          inputGain: 0,
          outputGain: 0,
          inputLevel: 0,
          outputLevel: 0,
          gainReduction: 0,
          effects: [],
        },
      });

      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Audio Context Initialization
  // ============================================================================

  describe('Audio Context Initialization', () => {
    it('should initialize AudioContext with stream', async () => {
      const mockStream = { id: 'stream-1' } as MediaStream;

      await service.initializeAudioContext(mockStream);

      expect(global.AudioContext).toHaveBeenCalled();
      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
      expect(mockAudioContext.createAnalyser).toHaveBeenCalled();
    });

    it('should resume suspended AudioContext', async () => {
      mockAudioContext.state = 'suspended';
      const mockStream = { id: 'stream-1' } as MediaStream;

      await service.initializeAudioContext(mockStream);

      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('should return processed stream', async () => {
      const mockStream = { id: 'stream-1' } as MediaStream;

      await service.initializeAudioContext(mockStream);

      const processedStream = service.getProcessedStream();
      expect(processedStream).toBeDefined();
    });

    it('should set analyzer FFT size', async () => {
      const mockStream = { id: 'stream-1' } as MediaStream;

      await service.initializeAudioContext(mockStream);

      expect(mockAnalyserNode.fftSize).toBe(2048);
    });
  });

  // ============================================================================
  // Cleanup
  // ============================================================================

  describe('Cleanup', () => {
    it('should destroy service', async () => {
      const mockStream = { id: 'stream-1' } as MediaStream;
      await service.initializeAudioContext(mockStream);

      service.destroy();

      expect(mockAudioContext.close).toHaveBeenCalled();
    });
  });
});
