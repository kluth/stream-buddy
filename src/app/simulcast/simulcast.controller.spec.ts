import { Test, TestingModule } from '@nestjs/testing';
import { SimulcastController } from './simulcast.controller';

describe('SimulcastController', () => {
  let controller: SimulcastController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SimulcastController],
    }).compile();

    controller = module.get<SimulcastController>(SimulcastController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
