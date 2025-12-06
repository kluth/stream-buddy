import { Test, TestingModule } from '@nestjs/testing';
import { OverlayRenderController } from './overlay-render.controller';

describe('OverlayRenderController', () => {
  let controller: OverlayRenderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OverlayRenderController],
    }).compile();

    controller = module.get<OverlayRenderController>(OverlayRenderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
