import { Test, TestingModule } from '@nestjs/testing';
import { OverlayRenderService } from './overlay-render.service';

describe('OverlayRenderService', () => {
  let service: OverlayRenderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OverlayRenderService],
    }).compile();

    service = module.get<OverlayRenderService>(OverlayRenderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
